import { annotation, annotationLabel, annotationCustomType } from 'd3-svg-annotation';
import { select } from "d3-selection";
import { camelCaseToDash, mapCelsiusToRadians } from './utils';

export const addAnnotations = (selection, containerSize) => {
  const annotations = generateAnnotations(selection);
  const ann = annotation().annotations(annotations);

  selection.call(ann);

  // remove previously rendered annotation connector end circles
  selection.selectAll('.annotation-connector circle').remove();

  insertAnnotationsContent(selection);
  ann.update();

  calculateBestPlaceForAnnotations(ann, selection, containerSize);
};

function generateAnnotations (selection) {
  const annotations = [];
  
  const dx = 25;
  const dy = 40;
  const connectorColor = '#49565d';

  selection.each(function(d) {
    d.forEach((item, i) => {
      const config = item.annotation.config || {};
      const angelCelsius = config.angel || 30;
      
      // circles annotations
      if (item.sets.length === 1) {
        const color = item.circleStyles
          ? item.circleStyles.stroke || item.circleStyles.fill
          : connectorColor;
        const annotationType = annotationCustomType(annotationLabel, {
          "connector": {
            "type":"elbow"
          },
          "note":{
            "align": config.align || "middle", // bottom for tablets
            "orientation":"leftRight"
          }
        });
        const commonData = {
          dy,
          type: annotationType,
          className: `${item.sets[0]}`,
          note: {
            wrap: 250,
            padding: config.notePadding || 10, // ~ -40 for tablets
            wrapSplitter: /\n/,
            placement: config.placement
          },
          color,
        };

        const { circle } = item.circleData.arcs[0];

        if (i) {
          const { circle: biggestCircle } = d[0].circleData.arcs[0];
          const angel = calculateAngelOnSmallerCircle(
            90 - angelCelsius,
            biggestCircle.radius,
            circle.radius
            );
            
            annotations.push({
              ...commonData,
              x: circle.x + circle.radius * Math.cos(angel),
              y: circle.y + circle.radius * Math.sin(angel),
              dx,
            });
            
          } else {
          const angel = mapCelsiusToRadians(180 - angelCelsius);

          annotations.push({
            ...commonData,
            x: circle.x + circle.radius * Math.cos(angel),
            y: circle.y + circle.radius * Math.sin(angel),
            dx: -dx,
          });
        } 
        // intersection annotation
      } else {
        const { intersectionPoints } = item.circleData;

        if (!intersectionPoints.length) {
          return;
        }

        const dy = Math.max(...item.circleData.arcs.map((arc) => arc.circle.radius)) + 5;

        annotations.push({
          x: intersectionPoints[0].x,
          y: Math.abs(intersectionPoints[0].y + intersectionPoints[1].y) / 2,
          dx: 0,
          dy: config.position === 'top' ? -dy : dy,
          className: 'intersection-annotation',
          note: {
            padding: 7,
            align: "middle",
          },
          color: connectorColor,
          type: annotationLabel
        });
      }
    });
  });

  return annotations;
}

function drawAnnotationConnectorEndCircle (ann) {
  ann.annotations().forEach(function (d) {

    if (d.shouldBeRemoved) {
      select(`.${d.className} .annotation-connector circle`).remove();
      return;
    }

    select(`.${d.className} .annotation-connector`)
      .append('circle')
      .attr('cx', d.dx)
          .attr('cy', d.dy)
          .attr('r', 2)
          .attr('class', `${d.className}-connector-dot`)
          .style('fill', d.color);
  });

  ann.update();
}

function insertAnnotationsContent (selection) {
  function applyStyles (tspan, styles) {
    Object.keys(styles).forEach(style => {
      const cssStyle = camelCaseToDash(style);
      tspan.attr([cssStyle], styles[style]);
    });
  }

  selection.each(function(d) {
    d.forEach(item => {
      const annotationContent = item.annotation.content;
  
      if (annotationContent) {
        const annotationLabel = selection.select(
          `${item.sets.length === 1 ? `.${item.sets[0]}` : '.intersection-annotation'} .annotation-note-label`
        );
    
        item.annotation.content.forEach(a => {
          const tspan = annotationLabel.append('tspan').text(a.text);
    
          a.style && applyStyles(tspan, a.style);
    
        });
      }
    });
  });
}

function calculateBestPlaceForAnnotations (ann, selection, containerSize) {
    const circles = [];

    selection.each(function (d) {
      d.forEach(item => {
        if (item.circleData.arcs.length === 1) {
          circles.push(item.circleData.arcs[0].circle);
        }
      });
    });

    if (circles.length < 2) {
      drawAnnotationConnectorEndCircle(ann);
      return;
    }

    const rSum = circles[0].radius + circles[1].radius;
    const circlesCentersDistance = Math.abs(circles[0].x - circles[1].x);
    const x = circles[0].x + circles[0].radius - ((rSum - circlesCentersDistance) / 2);

    ann.annotations().forEach(function(d) {
      if (d.className === 'intersection-annotation') {
        const size = selection.select('.intersection-annotation .annotation-note-label').node().getBBox();
        
        if (!size.width || circles.length < 2) {
          return;
        }
        

        if (rSum - circlesCentersDistance >= size.width + 32) {
          d.position = { x, y: d.position.y + size.y - size.height / 2 };
          d.offset = { x: 0, y: 0 };
          d.shouldBeRemoved = true;

        }
      } else {
        const annotationsContainerSize = selection.node().getBoundingClientRect();

        const widthDiff = containerSize.width - annotationsContainerSize.width;

        if (widthDiff && d.note.placement === 'containerEdge') {
          const paddingOffset = widthDiff / 2;

          d.note.padding = d.note.padding + paddingOffset - 10;

        }
      }

    });
    
    drawAnnotationConnectorEndCircle(ann);
}

function calculateAngelOnSmallerCircle (biggerCircleAngel, biggerCircleRadius, smallerCircleRadius) {
  const trapezeHeight = biggerCircleRadius * Math.cos(mapCelsiusToRadians(biggerCircleAngel));

  const cosineOfAngel = trapezeHeight / smallerCircleRadius;

  return Math.PI / 2 - Math.acos(cosineOfAngel);
}
