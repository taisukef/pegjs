/*
 * Computes indices of variables used for storing match results and parse
 * positions in generated code. These variables are organized as one stack. The
 * following will hold after running this pass:
 *
 *   * All nodes except "grammar" and "rule" nodes will have a |resultIndex|
 *     property. It will contain an index of the variable that will store a
 *     match result of the expression represented by the node in generated code.
 *
 *   * Some nodes will have a |posIndex| property. It will contain an index of
 *     the variable that will store a parse position in generated code.
 *
 *   * All "rule" nodes will contain |resultCount| property. It will contain a
 *     count of distinct values of |resultIndex| and |posIndex| properties used
 *     in rule's subnodes. (This is useful to declare variables in generated
 *     code.)
 */
PEG.compiler.passes.computeVarIndices = function(ast) {
  function computeLeaf(node, index) { return 0; }

  function computeFromExpression(delta) {
    return function(node, index) {
      var depth;

      node.expression.resultIndex = delta.result > 0
        ? index + delta.result + delta.pos
        : node.resultIndex;

      depth = compute(
        node.expression,
        index + delta.result + delta.pos
      );

      if (delta.pos !== 0) {
        node.posIndex = index + delta.pos;
      }

      return depth + delta.result + delta.pos;
    };
  }

  var compute = buildNodeVisitor({
    grammar:
      function(node, index) {
        each(node.rules, function(node) {
          node.resultIndex = index;
          compute(node, index);
        });
      },

    rule:
      function(node, index) {
        var depth;

        node.expression.resultIndex = node.resultIndex;

        depth = compute(node.expression, index);

        node.resultCount = depth + 1;
      },

    named:        computeFromExpression({ result: 0, pos: 0 }),

    choice:
      function(node, index) {
        var depths = map(node.alternatives, function(alternative) {
          alternative.resultIndex = node.resultIndex;

          return compute(alternative, index);
        });

        return Math.max.apply(null, depths);
      },

    action:       computeFromExpression({ result: 0, pos: 1 }),

    sequence:
      function(node, index) {
        var depths = map(node.elements, function(element, i) {
          element.resultIndex = index + i + 2;

          return compute(element, index + i + 2);
        });

        node.posIndex = index + 1;

        return node.elements.length > 0
          ? Math.max.apply(
              null,
              map(depths, function(d, i) { return i + d; })
            )
            + 2
          : 1;
      },

    labeled:      computeFromExpression({ result: 0, pos: 0 }),
    simple_and:   computeFromExpression({ result: 0, pos: 1 }),
    simple_not:   computeFromExpression({ result: 0, pos: 1 }),
    semantic_and: computeLeaf,
    semantic_not: computeLeaf,
    optional:     computeFromExpression({ result: 0, pos: 0 }),
    zero_or_more: computeFromExpression({ result: 1, pos: 0 }),
    one_or_more:  computeFromExpression({ result: 1, pos: 0 }),
    rule_ref:     computeLeaf,
    literal:      computeLeaf,
    "class":      computeLeaf,
    any:          computeLeaf
  });

  compute(ast, 0);
};