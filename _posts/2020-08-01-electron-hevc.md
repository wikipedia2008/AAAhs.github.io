---
layout: post
title: "编译 ELectron ，实现 HEVC/H.265 视频播放"
categories: work
---

# 简介

公司里的视频项目的资源较多，文件体积大，不仅很占用磁盘空间，而且传播时很占用带宽，所以在某一次决定里计划将所有视频从 H264 格式转成 H265 格式，这样视频资源体积起码降低了 1/3 的大小，也降低了带宽的占用。

由于项目的 PC 客户端使用的是基于 Chromium 和 Nodejs 的 Electron 框架编写的，所以经过调研后，网上有好几种方案，最后参考了 [修改 Chromium 源码，实现 HEVC/H.265 4K 视频播放](https://www.infoq.cn/article/s65bFDPWzdfP9CQ6Wbw6) 这边文章，决定尝试编译一下 Electron ，让能够直接通过 `<video>` 标签就能播放 H265 视频。

下面的内容仅仅记录我在构建时遇到的问题，如果想直接下载支持 H265 播放的 Electron ，可以点击 [这里](https://github.com/AAAhs/electron-hevc/releases/tag/v9.1.2-hevc) 下载对应平台的 Electron。

# Build Chromium

如何构建 chromium ，官网有详细的文档 
[基于 Window 的构建教程](https://chromium.googlesource.com/chromium/src/+/master/docs/windows_build_instructions.md)、
[基于 Linux 的构建教程](https://chromium.googlesource.com/chromium/src/+/master/docs/linux/build_instructions.md)、
[基于 Mac 的构建教程](https://chromium.googlesource.com/chromium/src/+/master/docs/mac_build_instructions.md)。

下面我用的都是 Linux 环境去构建的。

**整个过程大概步骤为：**

1. 安装构建依赖
2. 拉取源码
3. 安装源码依赖
4. 生成对应的构建配置
5. 构建项目

其中构建项目花费的时间极长，我用 6 核 16G 电脑第一次构建，花了 5 小时以上。

## 拉取源码 & 安装源码依赖

chromium 构建工具 depot_tools 包含了很多 py 脚本，下面提到的 fetch、gclient、gn、autoninja 都是 depot_tools 里包含的。

其中 fetch 是用来拉取源码的。最后还会自动生成 .gclient 文件。

```sh
$ fetch --nohooks --no-history chromium 
```

- --no-history 如果不加的话，会整个项目的提交历史都会拉取下来，项目总大小超过 10G。
- --nohooks 如果不加的话，完成后会自动执行 `gclient runhooks` ，用来下载需要的二进制文件等。

拉取源码后，还得执行源码里的文件，去安装依赖。**此安装是一次性的**。
```sh
$ ./build/install-build-deps.sh
```

如果之前 fetch 命令加了 --nohooks 参数，则此时才需要手动执行下面的命令去下载二进制文件等。
```sh
$ gclient runhooks
```

## gclient

gclient 是谷歌开发的一套跨平台 git 仓库管理工具，用来将多个git仓库组成一个solution进行管理。

```
# 跟源码 src 文件夹同级的 .gclient 文件，内容就这么点。
solutions = [
  {
    "url": "https://chromium.googlesource.com/chromium/src.git",    # Solution仓库地址
    "managed": False,
    "name": "src",          # 拉取代码后存放的位置
    "custom_deps": {},      # 自定义依赖的仓库地址
    "custom_vars": {}, 
  },
]
```

其实 fetch 命令的执行步骤就是拉取源码，生成 .gclient 文件，执行 gclient sync 去同步所有子仓库文件等。

所以如果不使用 fetch 命令的话，可以这么干：

```sh
$ $ git clone https://github.com/chromium/chromium.git # 手动从 git 仓库拉取源码
mv chromium-src src
$ vim .gclient # 自己编辑 .gclient 或者执行 gclient config https://github.com/chromium/chromium.git 去生成
$ gclient sync --nohooks --no-history # 根据 .gclient 配置同步整个依赖树
```

## 生成构建配置 & 构建项目

```sh
$ gn gen out/Default # 生成构建配置
```

gn 生成的构建配置默认是没有任何参数的，但是往往我们需要添加构建参数在里面，比如是否 debug 模式，是否 release 版本等，所以要这么干：

```sh
$ gn args out/Default # 将会出现一个文本编辑，保存关闭后，就会生成构建配置
$ gn args out/Default --list # 如果不确定自己的参数有没有用到，那么后面可以执行这个来查看每个参数的作用
```

`gn args out/Default --list` 这个命令很重要，在网上复制的构建参数必须看一下每个参数作用是什么，不要直接复制然后生成，否则可能一堆坑。
每个参数也在源码里能够全局搜索到的，源码也有很多注释，方便理解。

```sh
$ autoninja -C out/Default chrome # 最后是构建项目
```

编译后去修改代码，再次编译，只会编译涉及到的文件。


# 修改 Chromium 源码

直接参考 [修改 Chromium 源码，实现 HEVC/H.265 4K 视频播放](https://www.infoq.cn/article/s65bFDPWzdfP9CQ6Wbw6) 这个文章去修改即可。

在 [chromium.woolyss.com](https://chromium.woolyss.com) 网站里可以直接下载能够直接播放 H265 的 Chromium ，也是修改过源码重新 Build 的。


# Build Electron

如何构建 Electron ，这里有更详细的 [文档](https://github.com/electron/build-tools)。

```sh
# 初始化目录，里面包含了构建配置
$ e init master-release -i release --root=~/electron-release

# 将官方仓库地址改成我修改过的 Electron 仓库地址，里面添加了我修改源码的补丁文件，里面的 Electron 为本人编写本文章时最新的 v9.1.2 版本
$ vim $(e show root)/.gclient
- "url": 'https://github.com/electron/electron'  
+ "url": 'https://github.com/AAAhs/electron'

# 同步代码下来，指定了我仓库里的 v9.1.2-hevc Tag
$ e sync --revision v9.1.2-hevc

# 构建 Electron
$ e build

# 打包
$ cd $(e show root)/src
$ electron/script/strip-binaries.py -d out/Release
$ e build electron:dist
```

# Release

[点击这里](https://github.com/AAAhs/electron-hevc/releases/tag/v9.1.2-hevc) 可以下载我打包好的 Electron。
