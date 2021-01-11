import { annotation, annotationLabel, annotationCustomType } from 'd3-svg-annotation';
import {select, selectAll} from "d3-selection";
import { getIntersectionPoints } from './circleintersection';
import { camelCaseToDash, mapCelsiusToRadians } from './utils';

export const createAnnotationGenerator = (circles, data) => {
  const circlesArr = Object.keys(circles).reduce((acc, circleId) => {
    acc.push({
      id: circleId,
      ...circles[circleId]
    });

    return acc;
  }, []);
  const annotations = produceAnnotationsConfig(circlesArr, data);  
  return (selection) => {
    const ann = annotation().annotations(annotations);
    selection.call(ann);

    // remove previously rendered annotation connector end circles if need
    selectAll('.annotation-connector circle').remove();

    drawAnnotationConnectorEndCircle();
    insertAnnotations(data, ann);

  };
};

function produceAnnotationsConfig (circlesArr, data) {
  const constants = {
    annotationConnectorOffsetInCelsius: 30,
    annotationConnectorDx: 25,
    annotationConnectorDy: 40,
  };
  const intersectionPoints = getIntersectionPoints(circlesArr);

  const firstCircleAnnotationConnectorCorner = mapCelsiusToRadians(180 - constants.annotationConnectorOffsetInCelsius);
  const secondCircleAnnotationConnectorCorner = calculateAngelOnSmallerCircle(
    90 - constants.annotationConnectorOffsetInCelsius, 
    circlesArr[0].radius, 
    circlesArr[1].radius);

  const annotationType = annotationCustomType(annotationLabel, {
    "connector": {
      "type":"elbow"
    },
    "note":{
      "align":"middle",
      "orientation":"leftRight"
    }
  });

  const connectorColor = '#49565d';

  const annotations = circlesArr.map((circle, i) => {
    const circleFullData = data.find(item => item.sets.length === 1 && item.sets[0] === circle.id);

    const color = circleFullData.circleStyles 
      ? circleFullData.circleStyles.stroke || circleFullData.circleStyles.fill 
      : connectorColor;
    const commonConfigData = {
      dy: constants.annotationConnectorDy,
      type: annotationType,
      className: `${circle.id}`,
      note: {
        wrap: 250,
        padding: 10,
        wrapSplitter: /\n/
      },
      color,
    };

    if (i) {
      return {
        ...commonConfigData,
        x: circle.x + circle.radius * Math.cos(secondCircleAnnotationConnectorCorner), 
        y: circle.y + circle.radius * Math.sin(secondCircleAnnotationConnectorCorner),
        dx: constants.annotationConnectorDx,
      };
    }

    return {
      ...commonConfigData,
      x: circle.x + circle.radius * Math.cos(firstCircleAnnotationConnectorCorner), 
      y: circle.y + circle.radius * Math.sin(firstCircleAnnotationConnectorCorner),
      dx: -constants.annotationConnectorDx,   
    };
  });
  // TODO: update the logic below for case with more than 2 circles
  if (intersectionPoints.length) {
    annotations.push({
      x: intersectionPoints[0].x,
      y: Math.abs(intersectionPoints[0].y + intersectionPoints[1].y) / 2,
      dx: 0,
      dy: Math.max(...circlesArr.map(circle => circle.radius)),
      className: 'intersection-annotation',
      note: {
        padding: 10,
        align: "middle",
      },
      color: connectorColor,
      type: annotationLabel
    });
  }

  return annotations;
}

function drawAnnotationConnectorEndCircle () {
  selectAll('.annotation-connector').datum(function(d) {
    select(this).append('circle')
      .attr('cx', d._dx)
      .attr('cy', d._dy)
      .attr('r', 2)
      .attr('class', `${d._className}-connector-dot`)
      .style('fill', d._color);
  });
}

function insertAnnotations (data, ann) {
  function applyStyles (tspan, styles) {
    Object.keys(styles).forEach(style => {
      const cssStyle = camelCaseToDash(style);
      tspan.attr([cssStyle], styles[style]);
    });
  }
  
  data.forEach((item) => {
    if (!item.annotation) {
      return;
    }

    const annotationLabel = select(
      `${item.sets.length === 1 ? `.${item.sets[0]}` : '.intersection-annotation'} .annotation-note-label`
    );

    item.annotation.forEach(a => {
      const tspan = annotationLabel.append('tspan').text(a.text);

      a.style && applyStyles(tspan, a.style);
    });

    ann.update();

  });
}

function calculateAngelOnSmallerCircle (biggerCircleAngel, biggerCircleRadius, smallerCircleRadius) {
  const trapezeHeight = biggerCircleRadius * Math.cos(mapCelsiusToRadians(biggerCircleAngel));

  const cosineOfAngel = trapezeHeight / smallerCircleRadius;

  return Math.PI / 2 - Math.acos(cosineOfAngel);
}
