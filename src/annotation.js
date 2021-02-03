import { annotation, annotationLabel, annotationCustomType } from 'd3-svg-annotation';
import { camelCaseToDash, mapCelsiusToRadians } from './utils';

export const addAnnotations = (selection, configuration) => {
  if (!selection.select('.annotations').empty()) {
    performAnnotationTransition(selection, configuration);
    return;
  }

  const annotations = generateAnnotations(selection);
  const ann = annotation().annotations(annotations);

  selection.call(ann);

  insertAnnotationsContent(selection);

  ann.update();

  calculateBestPlaceForAnnotations(ann, selection, configuration);
};

function generateAnnotations (selection) {
  const annotations = [];

  const connectorColor = '#49565d';
  
  selection.each(function(d) {
    d.forEach((item) => {
      const config = item.annotation.config || {};
      const position = calculateAnnotationPosition(item, d);

      // circles
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
        const commonCirclesData = {
          dy: position.dy,
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
            
        annotations.push({
          ...commonCirclesData,
          x: position.x,
          y: position.y,
          dx: position.dx,
        });

      // intersection annotation
      }  else {
        if (position) {
          annotations.push({
            x: position.x,
            y: position.y,
            dx:position.dx,
            dy: position.dy,
            className: 'intersection-annotation',
            note: {
              padding: 7,
              align: "middle",
            },
            color: connectorColor,
            type: annotationLabel
          });
        }

      }
    });
  });

  return annotations;
}

function drawAnnotationConnectorEndCircle (ann, selection) {
  ann.annotations().forEach(function (d) {
    if (d.shouldBeRemoved) {
      selection.select(`.${d.className} .annotation-connector circle`).remove();
      return;
    }

    selection.select(`.${d.className} .annotation-connector`)
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
    drawAnnotationConnectorEndCircle(ann, selection);
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

        d.note.padding = d.note.padding + paddingOffset;

      }
    }
  });
  
  drawAnnotationConnectorEndCircle(ann, selection);
}

function calculateAngelOnSmallerCircle (biggerCircleAngel, biggerCircleRadius, smallerCircleRadius) {
  const trapezeHeight = biggerCircleRadius * Math.cos(mapCelsiusToRadians(biggerCircleAngel));

  const cosineOfAngel = trapezeHeight / smallerCircleRadius;

  return Math.PI / 2 - Math.acos(cosineOfAngel);
}

function performAnnotationTransition (selection, configuration) {
  const data = selection.datum();

  const hiddenG = selection.append('g')
    .attr('class', 'hidden-annotations-container')
    .attr('visibility', 'hidden');

  const annotations = generateAnnotations(hiddenG);

  const ann = annotation().annotations(annotations);
  hiddenG.call(ann);
 
  insertAnnotationsContent(hiddenG);
  ann.update();

  calculateBestPlaceForAnnotations(ann, hiddenG, configuration);

  data.forEach((item, i) => {
    const annotationLabel = selection.select(`.annotations-container > .annotations .annotation.label.${item.sets.length === 1 ? item.sets[0] : 'intersection-annotation'}`);
    
    const annotationNote = annotationLabel.select(`.annotation-note`);
    const annotationNoteContent = annotationLabel.select(`.annotation-note-content`);
    const annotationConnector = annotationLabel.select('.connector');
    const endCircle = annotationLabel.select('circle');

    const newAnnotationLabel = hiddenG.select(`.annotations .annotation.label.${item.sets.length === 1 ? item.sets[0] : 'intersection-annotation'}`);
    const newAnnotationNote = newAnnotationLabel.select(`.annotation-note`);
    const newAnnotationNoteContent = newAnnotationLabel.select(`.annotation-note-content`);
    const newAnnotationConnector = newAnnotationLabel.select('.connector');
    const newEndCircle = newAnnotationLabel.select('circle');

    if (!newAnnotationLabel.empty() && !annotationLabel.empty()) {
      annotationLabel.transition().duration(configuration.duration).attr('transform', newAnnotationLabel.attr('transform'));
      annotationNote.transition().duration(configuration.duration).attr('transform', newAnnotationNote.attr('transform'));
      annotationNoteContent.transition().duration(configuration.duration).attr('transform', newAnnotationNoteContent.attr('transform'));
      annotationConnector.transition().duration(configuration.duration).attr('d', newAnnotationConnector.attr('d'));
  
      if (newEndCircle.empty() && !endCircle.empty()) {
        annotationLabel.select('.annotation-connector circle').transition().duration(configuration.duration)
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 0)
        .on('end', () => endCircle.remove());
      } else if (!newEndCircle.empty() && endCircle.empty()) {
        annotationLabel.select('.annotation-connector')
          .append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', 0);
        annotationLabel.select('.annotation-connector circle').transition().duration(configuration.duration)
          .attr('cx', newEndCircle.attr('cx'))
          .attr('cy', newEndCircle.attr('cy'))
          .attr('r', 2);
        setTimeout(() => {
        }, configuration.duration);
      } else if (!newEndCircle.empty() && !endCircle.empty()) {
        endCircle.transition().duration(100).attr('cx', newEndCircle.attr('cx')).attr('cy', newEndCircle.attr('cy'));
      }
    } else if (newAnnotationLabel.empty() && newAnnotationLabel.empty()) {
      annotationLabel.remove();
    } else if (annotationLabel.empty() && !newAnnotationLabel.empty()) {
      setTimeout(() => {
        selection.select('.annotations-container .annotations').node().appendChild(newAnnotationLabel.node());
      }, configuration.duration);
    }

  });

  hiddenG.remove();
}

function calculateAnnotationPosition (annotationData, allData) {
  if (annotationData.sets.length === 1) {
    return calculateCircleAnnotationPosition(annotationData, allData);
  }

  return calculateIntersectionAnnotationPosition(annotationData);
}

function calculateCircleAnnotationPosition (annotationData, allData) {
  const config = annotationData.annotation.config || {};

  const { circle } = annotationData.circleData.arcs[0];
  const allCircles = extractCirclesFromData(allData);

  const angelCelsius = config.angel || 30;
  const smallestX = Math.min(...allCircles.map(c => c.x));
  const biggestRadius = Math.max(...allCircles.map(c => c.radius));
  const angel = circle.x === smallestX // bigger circle always will be on the left side of the screen
    ? mapCelsiusToRadians(180 - angelCelsius)
    : calculateAngelOnSmallerCircle(90 - angelCelsius, biggestRadius, circle.radius); 

  const dy = 40;  
  const dx = circle.x === smallestX ? -25 : 25;
  const x = circle.x + circle.radius * Math.cos(angel);
  const y = circle.y + circle.radius * Math.sin(angel);

  return { x, y, dx, dy };
}

function calculateIntersectionAnnotationPosition (annotationData) {
  const { intersectionPoints } = annotationData.circleData;
  
  if (!intersectionPoints.length) {
    return;
  }
  
  const config = annotationData.annotation.config || {};
  const dy = Math.max(...annotationData.circleData.arcs.map((arc) => arc.circle.radius)) + 5;

  return {
    x: intersectionPoints[0].x,
    y: Math.abs(intersectionPoints[0].y + intersectionPoints[1].y) / 2,
    dx: 0,
    dy: config.position === 'top' ? -dy : dy,
  };
}

function extractCirclesFromData (data) {
  const circles = data.reduce((acc, item) => {
    if (item.sets.length !== 1) {
      return acc;
    }

    acc.push(item.circleData.arcs[0].circle);

    return acc;
  }, []);

  return circles;
}


