import localforage from 'localforage';
import Tensorset from 'tensorset';

var classes = [];

var consoleEl = document.getElementById('console');
var classifiers = document.getElementsByName('classifier');
var remove = document.getElementById('remove');
var file = document.getElementById('file');
var classesEl = document.getElementById('classes');
var whiteboard = document.getElementById('whiteboard');
var add = document.getElementById('add');
var clear = document.getElementById('clear');
var test = document.getElementById('test');
var newEl = document.getElementById('new');

function log(text) {
    consoleEl.value = `
    ${text}
    ` + consoleEl.value;
}

function refreshClassOptions() {
    classesEl.innerHTML = '';

    for (var i = 0, l = classes.length; i < l; i++) {
        (function(classObject) {
            var container = document.createElement('div');
            container.setAttribute('class', 'class');
            var label = document.createElement('label');
            label.setAttribute('class', 'label');
            var text = document.createTextNode(classObject.name);
            var input = document.createElement('input');
            input.setAttribute('type', 'radio');
            input.setAttribute('value', classObject.label);
            input.setAttribute('name', 'classifier');

            if ((i + 1) == l) {
                input.setAttribute('checked', true);
            }
            label.appendChild(input);
            label.appendChild(text);

            var a = document.createElement('a');
            a.innerHTML = 'X';
            a.setAttribute('class', 'cross');

            a.addEventListener('click', function() {
                var answer = confirm('Area you sure you want to remove?!');

                if (answer == true) {
                    classifier.clearClass(classObject.label);

                    log('Removed class `' + classObject.name + '`');
                }
            }, false);

            container.appendChild(label);
            container.appendChild(a);
            classesEl.appendChild(container);
        })(classes[i]);
    }
    classifiers = document.getElementsByName('classifier');
}

async function loadClassifier(json) {
    log('Loading classifier');

    var classifier = knnClassifier.create();
    var promise = localforage.getItem('classifier');

    if (json) {
        promise = Promise.resolve(json);
    }
    return promise
    .then(function(dataset) {
        if (!dataset) {
            return Promise.reject(new Error('No existing dataset.'));
        }
        dataset = JSON.parse(dataset);

        if (json) {
            log('Loaded classifier from file');
        } else {
            log('Loaded classifier from local storage');
        }
        classes = dataset.classes;
        dataset = Tensorset.parse(dataset.dataset);

        refreshClassOptions();

        classifier.setClassifierDataset(dataset);

        return classifier;
    })
    .catch(function() {
        log('Created empty classifier');

        return classifier;
    });
};

async function saveClassifier(classifier, returnOnly) {
    log('Saving classifier');

    var json;
    var dataset = classifier.getClassifierDataset();

    return Tensorset.stringify(dataset)
    .then(function(dataset) {
        json = dataset;
        json = JSON.stringify({ classes: classes, dataset: json });

        if (returnOnly) {
            return json;
        }
        return localforage.setItem('classifier', json);
    })
    .then(function(dataset) {
        if (!returnOnly) {
            log('Saved classifier to local storage');
        }
        return json;
    })
};

function removeClassifier() {
    log('Removed classifier');

    localforage.removeItem('classifier');

    classes = [];

    return knnClassifier.create();
};

var net, classifier;

mobilenet.load().then(function(loadedNet) {
    net = loadedNet;

    log('Mobilenet loaded');
});

loadClassifier()
.then(function(loadedClassifier) {
    classifier = loadedClassifier;
});

var x;
var y;
var paper = whiteboard.getContext('2d');
var pressedMouse = false; 
var lineColor ='#000000';
var fillColor ='#FFFFFF';
var lineWidth = random(1, 15);
var key = { 
    SAVE: 32, // space 
    CLEAR: 67, // c 
    TEST: 13, // enter,
    PREV_CLASS: 37, // arrow right
    NEXT_CLASS: 39, // arrow left
    NEW: 78, // n
};

paper.fillStyle = fillColor;
paper.fillRect(0, 0, whiteboard.width, whiteboard.height);

whiteboard.addEventListener('touchstart', startDrawing);
document.addEventListener('mousedown', startDrawing);
whiteboard.addEventListener('touchmove', drawLine);
document.addEventListener('mousemove', drawLine);
whiteboard.addEventListener('touchend', stopDrawing);
document.addEventListener('mouseup', stopDrawing);
document.addEventListener('keydown', keyDown);

function absoluteSize(ratio, width, height) {
    width = width || whiteboard.width;
    height = height || whiteboard.height;

    return Math.sqrt(
        Math.pow(width, 2) +
        Math.pow(height, 2)
    ) * ratio;
}

function findClassByLabel(label) {
    var found = null;

    classes.forEach(function(classObject) {
        if (classObject.label == label) {
            found = classObject;
        }
    });

    return found;
}

function random(min, max) {
    return Math.floor(Math.random() * max) + min;
}

var minPointDist = 0;
var paths = [];
var path = [];

function startDrawing(e) {
    e.stopPropagation();
    e.preventDefault();

    minPointDist = absoluteSize(0.005);

    pressedMouse = true;

    var rect = whiteboard.getBoundingClientRect();

    if (e.touches && e.touches.length) {
        e = e.touches[0];
    }
    x = ((e.clientX - rect.left) / whiteboard.offsetWidth) * whiteboard.width;
    y = ((e.clientY - rect.top) / whiteboard.offsetHeight) * whiteboard.height;

    path = [];
    path.push({ x: x, y: y });
}

function drawLine(e) {
    e.stopPropagation();
    e.preventDefault();

    if (pressedMouse) {
        whiteboard.style.cursor = 'crosshair';

        var rect = whiteboard.getBoundingClientRect();

        if (e.touches && e.touches.length) {
            e = e.touches[0];
        }
        var xM = ((e.clientX - rect.left) / whiteboard.offsetWidth) * whiteboard.width;
        var yM = ((e.clientY - rect.top) / whiteboard.offsetHeight) * whiteboard.height;

        var dist = Math.sqrt(
            Math.pow(xM - x, 2) +
            Math.pow(yM - y, 2)
        );

        if (dist < minPointDist) {
            return;
        }
        path.push({ x: xM, y: yM });

        drawingLine(x, y, xM, yM);

        x = xM;
        y = yM;
    }
}

function stopDrawing(e) {
    e.stopPropagation();
    e.preventDefault();

    paths.push(path);
    path = [];

    imageDataToBlob(pointsToImageData()).then(function(blob) {
        // console.log(URL.createObjectURL(blob));
    });

    pressedMouse = false;
    whiteboard.style.cursor = 'default';
}

function keyDown(e) {
    if (e.keyCode == key.PREV_CLASS || e.keyCode == key.NEXT_CLASS) {
        var radios = document.querySelectorAll('input[type=radio]');
        var totalRadios = radios.length;
        var foundIndex = 0;

        radios.forEach(function(radio, index) {
            if (radio.checked) {
                foundIndex = index;
            }
        });

        foundIndex += e.keyCode == key.PREV_CLASS ? -1 : 1;

        if (foundIndex < 0) {
            foundIndex = totalRadios - 1;
        } else if (foundIndex >= totalRadios) {
            foundIndex = 0;
        }
        radios[foundIndex].checked = true;
    }
    if (e.keyCode == key.NEW) {
        var answer = prompt('Name of the new class?');
        var value = null;

        for (var i = 0; i < classes.length; i++) {
            value = classes[i].label;
        }
        if (value === null) {
            value = 0;
        } else {
            value += 1;
        }
        classes.push({ name: answer, label: value });

        refreshClassOptions();
    }
    if (e.keyCode == key.TEST) {
        var data = paper.getImageData(0, 0, whiteboard.width, whiteboard.height);

        predict(data);

        paper.fillStyle = fillColor;
        paper.fillRect(0, 0, whiteboard.width, whiteboard.height);

        lineWidth = random(1, 15);
    }
    if (e.keyCode == key.SAVE) {
        var label = null;

        for (var i = 0; i < classifiers.length; i++) {
            if (classifiers[i].checked) {
               label = classifiers[i].value;
            }
        }
        if (label === null) {
            return;
        }
        var classObject = findClassByLabel(label);

        if (!classObject) {
            return;
        }
        log('Added example to class `' + classObject.name + '`');

        var data = paper.getImageData(0, 0, whiteboard.width, whiteboard.height);
        var activation = net.infer(tf.browser.fromPixels(data), true);

        classifier.addExample(activation, label);

        paper.fillStyle = fillColor;
        paper.fillRect(0, 0, whiteboard.width, whiteboard.height);

        lineWidth = random(1, 15);

        predict(data);

        saveClassifier(classifier);
    }
    if (e.keyCode == key.CLEAR) {
        log('Cleared whiteboard');

        paper.fillStyle = fillColor;
        paper.fillRect(0, 0, whiteboard.width, whiteboard.height);

        lineWidth = random(1, 15);
    }
}

function drawingLine(x_start, y_start, x_end, y_end) {
    paper.beginPath();
    paper.strokeStyle = lineColor;
    paper.lineWidth = lineWidth;
    paper.moveTo(x_start, y_start);
    paper.lineTo(x_end, y_end);
    paper.stroke(); 
    paper.closePath();
}

function imageDataToBlob(imageData) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');

    canvas.width = imageData.width;
    canvas.height = imageData.height;

    ctx.putImageData(imageData, 0, 0);

    return new Promise(function(resolve) {
        canvas.toBlob(resolve);
    });
};

function pointsToImageData() {
    var size = whiteboard.width;
    var lineWidth = size * 0.005;

    var boundingBox = {
        left: null,
        right: null,
        top: null,
        bottom: null
    };

    paths.forEach(function(points, index) {
        points.forEach(function(point) {
            if (boundingBox.left == null || point.x < boundingBox.left) {
                boundingBox.left = point.x;
            }
            if (boundingBox.right == null || point.x > boundingBox.right) {
                boundingBox.right = point.x;
            }
            if (boundingBox.top == null || point.y < boundingBox.top) {
                boundingBox.top = point.y;
            }
            if (boundingBox.bottom == null || point.y > boundingBox.bottom) {
                boundingBox.bottom = point.y;
            }
        });
    });

    var boundingWidth = boundingBox.right - boundingBox.left; 
    var boundingHeight = boundingBox.bottom - boundingBox.top; 
    var offsetLeft = -1 * boundingBox.left;
    var offsetTop = -1 * boundingBox.top;

    var width = size;
    var height = boundingHeight / boundingWidth * size;
    var ratio = size / boundingWidth;

    if (boundingWidth < boundingHeight) {
        width = boundingWidth / boundingHeight * size;
        height = size;
        ratio = size / boundingHeight;
    }
    var xOffset = Math.round((size - width) / 2);
    var yOffset = Math.round((size - height) / 2);

    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    var context = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);

    paths.forEach(function(points, index) {
        var prevPoint = null;

        context.beginPath();
        context.strokeStyle = '#000000';
        context.lineWidth = lineWidth;

        points.forEach(function(point) {
            var currentPoint = {
                x: point.x,
                y: point.y
            };
            
            currentPoint.x += offsetLeft;
            currentPoint.y += offsetTop;

            currentPoint.x *= ratio;
            currentPoint.y *= ratio;

            if (!prevPoint) {
                prevPoint = point;

                context.moveTo(currentPoint.x + xOffset, currentPoint.y + yOffset);

                return;
            }
            context.lineTo(currentPoint.x + xOffset, currentPoint.y + yOffset);
        });

        context.stroke(); 
        context.closePath();
    });

    return context.getImageData(0, 0, size, size);
};

function predict(imageData) {
    if (classifier.getNumClasses() > 0) {
        var activation = net.infer(imageData, 'conv_preds');
        
        classifier.predictClass(activation)
        .then(function(result) {
            var classObject = findClassByLabel(result.label);

            if (!classObject) {
                return;
            }
            log(`
            prediction: ${classObject.name}\n
            probability: ${result.confidences[result.label]}
            `);
        });
    }
}

remove.addEventListener('click', function() {
    var answer = confirm('Area you sure you want to remove?!');

    if (answer == true) {
        classifier = removeClassifier();
        refreshClassOptions();
    }
}, false);

save.addEventListener('click', function() {
    saveClassifier(classifier, true).then(function(json) {
        var blob = new Blob([json], { type: 'application/json' });
        var link = document.createElement('a');
        link.download = 'classifier-' + Date.now() + '.json';
        link.target = '_blank';
        link.href = URL.createObjectURL(blob);
        link.click();
    });
}, false);

file.addEventListener('change', function(e) {
    if (!file.files.length) {
        return;
    }
    var fileObject = file.files[0];

    var reader = new FileReader();

    reader.onload = function() {
        loadClassifier(reader.result)
        .then(function(loadedClassifier) {
            classifier = loadedClassifier;
        });
    };

    reader.onerror = function(err) {
        log('' + err);
    };

    reader.readAsText(fileObject);
});

add.addEventListener('click', function() {
    keyDown({ keyCode: key.SAVE });
}, false);

clear.addEventListener('click', function() {
    keyDown({ keyCode: key.CLEAR });
}, false);

test.addEventListener('click', function() {
    keyDown({ keyCode: key.TEST });
}, false);

newEl.addEventListener('click', function() {
    keyDown({ keyCode: key.NEW });
}, false);

