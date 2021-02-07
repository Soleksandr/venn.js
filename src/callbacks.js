import { select, selectAll } from 'd3-selection';

import { camelCaseToDash } from './utils';
import { sortAreas } from './diagram';

const TRANSITION_TIME = 400;

const clearHighlighted = () => {
  selectAll('.venn-area').each(function(d) {
    const node = select(this).select('path');
    const transition = node.transition().duration(TRANSITION_TIME);

    if ( d.circleStyles) {
      applyStyles(transition, d.circleStyles);
    } else {
      transition
        .style('fill-opacity', 0)
        .style('stroke', 'rgba(0,0,0,0)');
    }
  });
};

export const createHighlightAreaFunc = (containerId) => {
  return (...setsArr) => {
    clearHighlighted();
  
    setsArr.forEach(sets => {
      let node = null;
    
      const allCombinations = getAllSetsCombinations(sets);

      allCombinations.forEach(combination => {
        const setsSelection = select(`[data-venn-sets=${combination}]`);
    
        if (!setsSelection.empty()) {
          node = setsSelection;
        }
      });

      if (!node) {
        throw Error (`Unable to find ${sets} set`);
      }

      const selection = select(`#${containerId}`);

      sortAreas(selection, node.datum());
    
      return node.select('path').transition().duration(TRANSITION_TIME)
        .style('fill', '#333333')
        .style('fill-opacity', 0.4)
        .style('stroke-width', '2px')
        .style('stroke', '#333333');
    });
  };
};

function getAllSetsCombinations (sets) {
  return sets.reduce((allSetsCombination, set, i) => {
    sets.forEach((s, j) => {
      const newSets = [...sets];
      if (j) {
        newSets[j - 1] = sets[j];
        newSets[j] = set;
      }

      allSetsCombination.push(newSets.join('_'));
    });

    return allSetsCombination;
  }, []);
}

function applyStyles (node, styles) {
  Object.keys(styles).forEach(style => {
    const cssStyle = camelCaseToDash(style);
    node.style([cssStyle], styles[style]);
  });
}