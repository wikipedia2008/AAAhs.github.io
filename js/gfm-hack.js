/** Hack the anchor links and task list as github */
var linkifyAnchors = function (level, containingElement) {
  var headers = containingElement.getElementsByTagName("h" + level);
  for (var h = 0; h < headers.length; h++) {
    var header = headers[h];
    if (typeof header.id !== "undefined" && header.id !== "") {
      header.innerHTML = "<a id=\"user-content-" + header.id + "\" class=\"anchor\" href=\"#" + header.id + "\" aria-hidden=\"true\"><svg class=\"octicon octicon-link\" viewBox=\"0 0 16 16\" version=\"1.1\" width=\"16\" height=\"16\" aria-hidden=\"true\"><path fill-rule=\"evenodd\" d=\"M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z\"></path></svg></a>" + header.innerHTML;
    }
  }
};
var listTasks = function (containingElement) {
  var uls = containingElement.getElementsByTagName("ul");
  for (var i = 0; i < uls.length; i++) {
    var ul = uls[i];
    var lis = ul.getElementsByTagName("li");
    var isTask = false;
    for (var j = 0; j < lis.length; j++) {
      var li = lis[j];
      var s = li.innerHTML;
      var k = s.substring(0, 3);
      if (k == '[ ]') {
        isTask = true;
        li.className = 'task-list-item';
        li.innerHTML = '<input type="checkbox" class="task-list-item-checkbox" disabled="disabled">' + s.substring(3);
      } else if (k == '[x]') {
        isTask = true;
        li.className = 'task-list-item';
        li.innerHTML = '<input type="checkbox" class="task-list-item-checkbox" checked="checked" disabled="disabled">' + s.substring(3);
      }
    }
    if (isTask) {
      ul.className = 'task-list';
    }
  }
};
document.onreadystatechange = function () {
  if (this.readyState === "complete") {
    var contentBlock = document.getElementById("markdown-body");
    if (!contentBlock) return;
    
    // Anchor links
    for (var level = 2; level <= 6; level++) {
      linkifyAnchors(level, contentBlock);
    }
    // Task list
    listTasks(contentBlock);
  }
};