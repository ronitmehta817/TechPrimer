(function (global) {
  'use strict';

  function firstDirectiveLine(value) {
    var lines = String(value || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/);
    var index = 0;

    function skipIgnorable() {
      while (
        index < lines.length &&
        (!lines[index].trim() || /^\s*%%/.test(lines[index]))
      ) {
        index += 1;
      }
    }

    skipIgnorable();
    if (lines[index] && lines[index].trim() === '---') {
      index += 1;
      while (index < lines.length && lines[index].trim() !== '---') {
        index += 1;
      }
      if (index < lines.length) index += 1;
    }
    skipIgnorable();
    return index < lines.length ? lines[index].trim() : '';
  }

  function looksLikeMermaidSource(value) {
    var line = firstDirectiveLine(value);
    return (
      /^(?:classDiagram|sequenceDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|mindmap|timeline|quadrantChart|requirementDiagram|architecture-beta|block-beta|packet-beta|kanban|sankey-beta|radar-beta|treemap-beta|zenuml|info)$/i.test(line) ||
      /^flowchart(?:-\w+)?\s+(?:TB|BT|LR|RL|TD)$/i.test(line) ||
      /^graph\s+(?:TB|BT|LR|RL|TD)$/i.test(line) ||
      /^gitGraph(?:\s+(?:LR|TB|BT):?)?$/i.test(line) ||
      /^pie(?:\s+(?:showData|title\b.*))?$/i.test(line) ||
      /^xychart-beta(?:\s+horizontal)?$/i.test(line) ||
      /^C4(?:Context|Container|Component|Dynamic|Deployment)$/i.test(line)
    );
  }

  global.TechPrimerMermaidDetector = Object.freeze({
    firstDirectiveLine: firstDirectiveLine,
    looksLikeMermaidSource: looksLikeMermaidSource
  });
})(window);
