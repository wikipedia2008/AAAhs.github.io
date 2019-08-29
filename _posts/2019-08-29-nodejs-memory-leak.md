---
layout: post
title: "排查 Nodejs 内存泄漏"
categories: work
---

# 内存知识点

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境，这是来自 Node.js 官网的一段话，所以 V8 就是 Node.js 中使用的虚拟机，在之后讲解的 Node.js 中的 GC 其实就是在讲 V8 的 GC。

在 Node.js 环境里提供了 process.memoryUsage 方法用来查看当前进程内存使用情况，单位为字节

- rss（resident set size）：RAM 中保存的进程占用的内存部分，包括代码本身、栈、堆。
- heapTotal：堆中总共申请到的内存量。
- heapUsed：堆中目前用到的内存量，判断内存泄漏我们主要以这个字段为准。
- external： V8 引擎内部的 C++ 对象占用的内存。

堆用来存放对象引用类型，例如字符串、对象。

只要对象没有被任何的一个变量所引用，那么就会在下一个垃圾回收器运行时被释放。

测试的时候也直接直接调用 global.gc() 切手动执行垃圾回收机制，只需要启动程序时加上 --expose-gc 参数就能调用这个方法，比如 `node --expose-gc demo.js` 。

在 V8 中，每次 GC 时，是根据 root 对象 (浏览器环境下的 window，Node.js 环境下的 global ) 依次梳理对象的引用，如果能从 root 的引用链到达访问，V8 就会将其标记为可到达对象，反之为不可到达对象。被标记为不可到达对象（即无引用的对象）后就会被 V8 回收。

<!-- 
绝对大多数的应用程序对象的存活周期都会很短，而少数对象的存活周期将会很长为了利用这种情况，V8 将堆分为两类新生代和老生代，新空间中的对象都非常小大约为 1-8MB，这里的垃圾回收也很快。新生代空间中垃圾回收过程中幸存下来的对象会被提升到老生代空间。 -->

# 内存泄漏案例

## 闭包

```typescript
let theThing = null;
let replaceThing = function () {
    let leak = theThing;
    let unused = function () {
        if (leak)
            console.log("hi");
    };

    // 不断修改theThing的引用
    theThing = {
        longStr: new Array(1000000),
        someMethod: function () {
            console.log('a');
        }
    };
    global.gc();
    console.log((process.memoryUsage().heapUsed / 1024 / 1024) + ' MB');
};
setInterval(replaceThing, 100);
// 同一个函数内部的闭包作用域只有一个，所有闭包共享。在执行函数的时候，如果遇到闭包，则会创建闭包作用域的内存空间，将该闭包所用到的局部变量添加进去，然后再遇到闭包时，会在之前创建好的作用域空间添加此闭包会用到而前闭包没用到的变量。函数结束时，会清除没有被闭包作用域引用的变量。
// 在 testMemoryLeak 函数内有两个闭包：unused 和 someMethod。unused 这个闭包引用了父作用域中的 leak 变量，如果没有后面的 someMethod，则会在函数结束后被清除，闭包作用域也跟着被清除了。因为后面的 theThing 是全局变量，即 someMethod 是全局变量，它引用的闭包作用域（包含了 unused 所引用的 leak）不会释放。而随着 testMemoryLeak 不断的调用，leak 指向前一次的 theThing，下次的 theThing.someMethod 又会引用之前的 leak，从而形成一个闭包引用链，而 longStr 是一个大字符串，得不到释放，从而造成了内存泄漏。
```

**解决方案**

```typescript
// 传参来减少函数对外部变量的依赖
let unused = function (unused) {
    if (leak)
        console.log("hi");
};

// 或者在 replaceThing 方法的最后一行添加 
leak = null;
```

## 订阅事件后没有取消订阅

```typescript
const net = require('net');
let client = new net.Socket();

function connect() {
    client.connect(26665, '127.0.0.1', function callbackListener() {
        console.log('connected!');
    });
    global.gc();
    console.log(client.listenerCount('connect'), (process.memoryUsage().heapUsed / 1024 / 1024) + ' MB');
}
connect();

client.on('error', function (error) {
    // console.error(error.message);
});
client.on('close', function () {
    // console.error('closed!');
    // 泄漏代码
    client.destroy();
    setTimeout(connect, 100);
});

// 这个坑其实也不算问题，只是对 API 不熟悉而已，net 模块的重连每一次都会给 client 增加一个 connect 事件的侦听器，例子中必定连接失败，所以导致一直增加 connect 事件的侦听器。
```

**解决方案**

。。。看下 [Net 模块 的 API 文档](https://nodejs.org/api/net.html#net_socket_connect)，就知道怎么解决了

```typescript
function connect() {
    client.connect(26665, '127.0.0.1'); // 不要用最后的监听器参数
}
client.on('connect', function callbackListener() {
    console.log('connected!');
});
```

要不就每次失败时，使用 client.off 函数取消 connect 监听器

## 其他

其他的泄漏场景相对简单，比如 全局变量、全局缓存 等。


# 定位内存泄漏

平时为了避免内存泄漏，可以使用 ESLint 去检测代码去检查非期望的全局变量，非必要的话可以不写内部函数，绑定事件时记得在合适时间里清除事件。

## Heapdump

Heapdump 可以打印出内存快照，对比内存快照去找出泄漏位置。
具体操作看这个 [文章](https://github.com/nswbmw/node-in-debugging/blob/master/2.2%20heapdump.md#222-chrome-devtools)

但是这个不适合线上环境。

## Easy-Monitor

轻量级的 Node.js 项目内核性能监控 + 分析工具。 [Easy-Monitor](https://cnodejs.org/topic/58d0dd8b17f61387400b7de5)

## Alinode

Node.js 性能平台（Node.js Performance Platform）是面向中大型 Node.js 应用提供 性能监控、安全提醒、故障排查、性能优化等服务的整体性解决方案。[Alinode](https://www.aliyun.com/product/nodejs)

# 参考

1. https://zhuanlan.zhihu.com/p/25736931
2. https://cnodejs.org/topic/58eb5d378cda07442731569f
3. https://github.com/ElemeFE/node-interview/issues/7
4. https://github.com/frontend9/fe9-library/issues/290
5. https://github.com/nswbmw/node-in-debugging/blob/master/2.2%20heapdump.md
6. https://cnodejs.org/topic/5ab4a23bf5dfc27d7ad98b00
7. https://cnodejs.org/topic/58d0dd8b17f61387400b7de5