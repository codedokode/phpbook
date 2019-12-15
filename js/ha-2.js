(function () {
    "use strict";

    /*jshint expr: true */

    window.haStartGlaring = function (cfg) {

        if (isNotSupported()) {
            return false;
        }

        var isLoaded = false;
        var useSprite = cfg.useSprite;
        var spritePrefix = cfg.spritePrefix;
        var spriteCanvases = {};
        var spriteImageData = cfg.spriteImageData;
        var headSpriteData = null;
        var running = true;
        var bgColor = cfg.bgColor;
        var isRefreshQueued = false;
        var layers = cfg.layers;
        var lastTime = +new Date;
        var imageObjects = {};
        var imagesList;
        var pauseBtnNode = null;
        var canvas = null;
        var baseImage = cfg.baseImage; //'hair/base.jpg';
        var headImage = cfg.headImage; //'hair/head.png';
        var scrollSpeeds = [];
        var lastScrollPos = getScrollY();
        var lastAvgScroll = 0;
        var happiness = 0;
        var happinessLimit = 32;
        var happinessThreshold = 16;
        var happinessDrop = 4;
        var happinessWait = 700;
        var happinessBreak = 0;
        var isUserStopped = false;
        var pushThreshold = 400;
        var hugePushThreshold = 2000;
        var sweetMin = 50;
        var sweetMax = 200;
        var minWind = 0.3;
        var sweetWind = 1;
        var bigWind = 4;

        var innerMaxMulti = 1.1;


        var minDt = 0.001;
        var maxDt = 0.050;
        var stepTime = 0.004;
        var fRes = 15;
        var grav = 3000;
        var windA = 2300;

        var state = {
            wind: 0,
            blow: 0,
            blinkProb: 0.15,
            leftEye: 1,
            rightEye: 1,
            eyebrows: true,
            isClosingLeft: false,
            isClosingRight: false,
            dontOpenEyes: false,
            leftPhase: 0,
            rightPhase: 0
        };

        if (!spriteImageData) {
            throw "No spriteImageData";
        }

        var loadedState = parseInt(loadState(cfg.saveStateId), 10);
        if (loadedState == 1) {
            isUserStopped = true;
            pause();
        }

        function startLoading() {

            imagesList = useSprite ? collectSpriteImages() : collectImagesList();

            waitForImages(imagesList, function () {                
                replaceDom(function() {
                    isLoaded = true;
                    cfg.onInit && cfg.onInit();
                    (useSprite) ? initSceneForSprites() : initScene();
                    renderScene(true);
                });
            });
        }

        function replaceDom(onReady) {
            var imageNode = cfg.imageNode;
            if (imageNode.height > 0) {
                startReplaceDom();
                onReady();
            } else {

                imageNode.onload = function () {
                    startReplaceDom();
                    onReady();
                };

                imageNode.onerror = function () {
                    throw "Error on image: '" + this.src +"'";
                };
            }
        }

        function startReplaceDom() {
            var imageNode = cfg.imageNode;
            canvas = imageNode.ownerDocument.createElement('canvas');
            canvas.width = imageNode.width;
            canvas.height = imageNode.height;

            var span = imageNode.ownerDocument.createElement('span');
            span.style.cssText = 'display: inline-block; vertical-align; top; position: relative;';

            pauseBtnNode = imageNode.ownerDocument.createElement('span');
            pauseBtnNode.style.cssText = 'position: absolute; width: 45px; height: 45px; top: 50%; left: 50%;' + 
                'margin: -22px 0 0 -22px; background: url("' + cfg.pauseImageUrl + '") no-repeat 0 0; display: none;';

            span.appendChild(canvas);
            span.appendChild(pauseBtnNode);

            if (!running) {
                pauseBtnNode.style.display = '';
            }

            imageNode.parentNode.replaceChild(span, imageNode);
            listen(span, 'mousedown', function () {
                togglePause();                
                if (!running) {
                    isUserStopped = true;
                } else {
                    isUserStopped = false;
                }

                saveState(cfg.saveStateId, isUserStopped ? 1 : 0);
            });
        }

        function queueFrame() {
            if (isRefreshQueued) {
                return;
            }

            var reqFn = window.requestAnimationFrame || window.mozRequestAnimationFrame;
            // if (running) {
                if (reqFn) {
                    reqFn(function () {
                        isRefreshQueued = false;
                        renderScene();
                    });
                } else {
                    setTimeout(function () {
                        isRefreshQueued = false;
                        renderScene();
                    }, 15);
                }
                isRefreshQueued = true;
            // }
        }


        function updateConfig(keys) {
            for (var k in keys) {
                cfg[k] = keys[k];
            }
        }

        function blink() {
            state.isClosingLeft = true;
            state.isClosingRight = true;
            state.dontOpenEyes = false;
        }

        function shutEyes() {
            if (!state.dontOpenEyes) {
                state.dontOpenEyes = true;
                state.isClosingLeft = true;
                state.isClosingRight = true;
            }
        }

        function openEyes() {
            if (state.dontOpenEyes) {
                state.dontOpenEyes = false;
                state.isClosingLeft = true;
                state.isClosingRight = true;   
            }
        }

        function togglePause() {
            running ? pause() : resume();
        }

        function pause() {
            if (running) {
                running = false;
                if (isLoaded) {
                    pauseBtnNode.style.display = '';
                }
                // log('pause');
            }
        }

        function resume() {
            if (!running) {
                running = true;
                pauseBtnNode.style.display = 'none';
                // log('resume');
                if (isLoaded) {
                    queueFrame();
                }
            }
        }

        function push(how) {
            state.wind = how;
        }

        function blow(how) {
            state.blow = how;
        }


        function waitForImages(imgs, onload) {
            var missing = imgs.slice();
            var fired = false;
            
            for (var i = 0; i < imgs.length;  i++) {
                var img = new Image;
                img.onload = onImageLoad;
                img.onerror = function () {
                    throw "Failed to load: '" + this._url + "'";
                };
                img._url = imgs[i];
                img.src = imgs[i];                
                var alias = imgs[i];
                if (useSprite) {
                    alias = alias.replace(/^.*\/([^\/]+)/g, '$1');
                }
                imageObjects[alias] = img;
            }

            function onImageLoad() {
                var url = this._url;
                var left = [];
                for (var i = 0; i < missing.length; i++) {
                    if (missing[i] != url) {
                        left.push(missing[i]);
                    }
                }

                missing = left;
                if (missing.length <= 0 && !fired) {
                    fired = true;
                    onload();
                }
            }
        }

        function collectImagesList() {

            var images = [], imagesHash = {};
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if (layer.img && !imagesHash[layer.img]) {
                    images.push(layer.img);
                    imagesHash[layer.img] = true;
                }
            }

            // images.push(baseImage);
            return images;
        }

        function collectSpriteImages() {
            var images = [], imagesHash = {};
            
            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                var img = layer.img;
                var sprite = spriteImageData[img];

                if (!sprite) {
                    throw "No sprite data for '" +  img+ "'";
                }

                layer.spriteData = sprite;
                var spriteImg = spritePrefix + sprite.sprite;
                if (!imagesHash[spriteImg]) {
                    imagesHash[spriteImg] = true;
                    images.push(spriteImg);
                }

                if (img == headImage) {
                    headSpriteData = sprite;
                }
            }

            if (!headSpriteData) {
                throw "Didn't find head sprite";
            }

            // images.push(baseImage);
            return images;
        }

        function initSceneForSprites() {

            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];            
                var spriteName = layer.spriteData.sprite;

                if (!spriteCanvases[spriteName]) {
                    var spriteImage = imageObjects[spriteName];
                    assert(!!spriteImage);

                    var spriteCanvas = document.createElement('canvas');
                    spriteCanvas.width = spriteImage.width;
                    spriteCanvas.height = spriteImage.height;
                    var spriteCanvasCtx = spriteCanvas.getContext('2d');
                    spriteCanvasCtx.drawImage(spriteImage, 0, 0);

                    spriteCanvases[spriteName] = spriteCanvas;
                }

                layer.spriteCanvas = spriteCanvases[spriteName];

                if (!layer.still) {
                    layer.angle = 0;
                    layer.v  = 0;
                    layer.cx = layer.spriteData.cx;
                    layer.cy = layer.spriteData.cy;
                }
            }

            renderInitialImage();
        }


        function initScene() {

            var colorKey = [0xaf, 0xf0, 0xf0];

            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];            

                var subCanvas = document.createElement('canvas');
                subCanvas.width = canvas.width;
                subCanvas.height = canvas.height;
                var ctx = subCanvas.getContext('2d');

                layer.ctx = ctx;
                layer.canvas = subCanvas;
                
                // Render image to canvas
                var imageObject = imageObjects[layer.img];
                ctx.drawImage(imageObject, 0, 0);   

                if (!layer.still) {                

                    // Find center point
                    var imageData = ctx.getImageData(0, 0, subCanvas.width, subCanvas.height);         
                    var data = imageData.data;
                    for (var j = 0; j < data.length; j+=4) {
                        if (data[j] == colorKey[0] && 
                            data[j + 1] == colorKey[1] && 
                            data[j + 2] == colorKey[2]) {                    

                            // Found
                            var cy = Math.floor(j / 4 / imageData.width);
                            var cx = j / 4 - cy * imageData.width;
                            // console.log("Point @ cx=" + cx + ", cy=" + cy + " for layer " + layer.img);
                            layer.cx = cx;
                            layer.cy = cy;
                            layer.angle = 0;
                            layer.v = 0;                    
                        }
                    }                
                }
            }

            renderInitialImage();
        }

        function renderInitialImage() {
            lastTime = +new Date;

            var ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // var baseImageObj = imageObjects[baseImage];
            // baseImageObj, 
            ctx.drawImage(cfg.imageNode, 0, 0);
        }

        function shouldStop() {

            if (state.isClosingRight || state.isClosingLeft ||
                state.isOpeningRight || state.isOpeningLeft) {
                return false;
            }

            var minA = 0.2;
            var minSp = 10;

            for (var i = 0; i < layers.length; i++) {
                var layer = layers[i];
                if (layer.still) {
                    continue;
                }

                if (Math.abs(layer.angle * cfg.maxAngleMultiplier * innerMaxMulti) > minA) {
                    return false;
                }

                if (Math.abs(layer.v) > minSp) {
                    return false;
                }
            }

            return true;
        }

        function shouldDraw(layer) {
            if (layer.part == 'eyebrows') {
                return state.eyebrows;
            } else if (layer.part == 'left') {
                return layer.phase == state.leftEye;
            } else if (layer.part == 'right') {
                return layer.phase == state.rightEye;
            }

            return true;
        }

        function updateScrollSpeed(dt) {

            var pos = getScrollY();
            var isNowVisible = isVisible(canvas);

            if (!isNowVisible) {
                pause();
            } else if (!isUserStopped) {
                resume();
            }


            if (dt < 0.00001) {
                lastScrollPos = pos;
                return;
            }

            var speed = (pos - lastScrollPos) / dt;
            lastScrollPos = pos;
            var keep = 10;

            scrollSpeeds.push(speed);

            if (scrollSpeeds.length > keep) {
                scrollSpeeds.shift();
            }

            var sum = 0;
            for (var i = 0; i < scrollSpeeds.length; i++) {
                sum += scrollSpeeds[i];
            }
            var avg = sum / scrollSpeeds.length;
            var dv = avg - lastAvgScroll;
            lastAvgScroll = avg;            

            if (Math.abs(dv) > hugePushThreshold) {
                var sgn = dv > 0 ? 1 : -1;
                push(-sgn * 2.5);
                if (Math.random() < 0.2) {
                    blink();
                }
            } else if (Math.abs(dv) > pushThreshold) {
                var sgn = dv > 0 ? 1 : -1;
                push(-sgn * 0.8);
            } 

            var now = +new Date;
            if (Math.abs(avg) > sweetMin && Math.abs(avg) < sweetMax) {
                blow(sweetWind);
                happiness = Math.min(happinessLimit, happiness + 1);
            } else {
                blow(minWind);
                happiness = Math.max(0, happiness - happinessDrop);
            }

            if (happiness > happinessThreshold) {
                if ((now - happinessBreak) > happinessWait) {
                    shutEyes();        
                }
            } else {
                openEyes();
                happinessBreak = now;
            }
        } 

        function renderScene(dontStop) {

            var t = +new Date;
            var dt = (t - lastTime) / 1000;
            lastTime = t;

            updateScrollSpeed(dt);

            if (!running && !dontStop) {
                queueFrame();
                return;
            }

            cfg.onEnterFrame && cfg.onEnterFrame(dt);
            updateAllItems(dt);   
            updateEyeState(dt);
            queueFrame();

            if (!dontStop && shouldStop()) {
                return;
            }

            var activeRect = useSprite ? 
                { x: headSpriteData.left, y: headSpriteData.top, w: headSpriteData.w, h: headSpriteData.h } : 
                { x: 59, y: 25, w: 184, h: 171 };
            var angleThreshold = 0.15;

            var ctx = canvas.getContext('2d');
            ctx.save();

            ctx.fillStyle = bgColor;
            ctx.fillRect(activeRect.x, activeRect.y, activeRect.w, activeRect.h);

            for (var i = 0; i < layers.length; i++) {

                ctx.save();
                var layer = layers[i];
                // var layerImage = imageObjects[layer.img];

                if (!layer.still) {
                    var angleRad = layer.angle / 180 * Math.PI * cfg.maxAngleMultiplier * innerMaxMulti;
                
                    if (Math.abs(layer.angle * cfg.maxAngleMultiplier * innerMaxMulti) > angleThreshold) {
                        ctx.translate(layer.cx, layer.cy);
                        ctx.rotate(angleRad);
                        ctx.translate(-layer.cx, -layer.cy);
                    }
                }

                if (!layer.still || shouldDraw(layer)) {                

                    if (useSprite) {
                        var spriteData = layer.spriteData, spriteCanvas = layer.spriteCanvas;
                        ctx.drawImage(spriteCanvas, spriteData.posX, spriteData.posY, spriteData.w, spriteData.h,
                            spriteData.left, spriteData.top, spriteData.w, spriteData.h);
                    } else {
                        ctx.drawImage(layer.canvas, activeRect.x, activeRect.y, activeRect.w, activeRect.h,
                            activeRect.x, activeRect.y, activeRect.w, activeRect.h);
                    }
                }

                ctx.restore();
            }

            ctx.restore();
        }

        function updateAllItems(dt) {

            var aPull = 0, tPull = 0;

            if (state.blow && !state.wind) {
                var prob = state.blow * dt; 
                if (Math.random() < prob) {
                    state.wind = state.blow > 2 ? 1.2 : 0.6;
                }
            }

            if (state.wind) {
                aPull = windA * state.wind;
                tPull = 0.010;
                state.wind = 0;
            }

            for (var i = 0; i< layers.length; i++) {
                var layer = layers[i];
                if (!layer.still) {
                    updateItemState(dt, layer, aPull, tPull);
                }
            }
        }

        function updateItemState(dt, item, aPull, tPull) {

            dt = Math.max(minDt, Math.min(maxDt, dt));
            var steps = Math.ceil(dt / stepTime);

            for (var i = 0; i < steps; i++) {
                var thisTime = i * stepTime;
                var thisDt = Math.min(stepTime, dt - i * stepTime);
                assert(thisDt >= 0);
                var tPullPerStep = Math.max(0, Math.min(stepTime, tPull - i * stepTime));
                assert(tPullPerStep >= 0);

                var signV = item.v > 0 ? 1 : (item.v < 0 ? -1 : 0);
                var aRes = - fRes * signV * cfg.multiRes;
                var aAcc = (tPullPerStep / thisDt) * aPull * cfg.multiAcc / item.mass;
                var aGrav = - grav * Math.sin(item.angle * Math.PI / 180) * cfg.multiGrav * item.mass;

                var newA = (aRes + aAcc + aGrav) * cfg.speedMultiplier;
                var newV = item.v + thisDt * newA;
                var newAngle = item.angle + item.v * thisDt + newA * thisDt * thisDt / 2;
                var maxAngle = item.maxAngle;

                if (newAngle > maxAngle) {
                    newAngle = maxAngle;
                    newV = 0;
                } else if (newAngle < -maxAngle) {
                    newAngle = -maxAngle;
                    newV = 0;
                }

                item.v = newV;
                item.angle = newAngle;

                cfg.onEachPoint && cfg.onEachPoint(thisTime, newAngle, item.color);
            }
        }

        function updateEyeState(dt) {

            if (!state.isClosingLeft && !state.isClosingRight && !state.dontOpenEyes) {
                var prob = state.blinkProb * dt;
                if (Math.random() < prob) {
                    state.isClosingLeft = true;
                    state.isClosingRight = true;
                }
            }

            var blinkTime = 9;

            if (state.isClosingLeft) {
                if (state.leftPhase < blinkTime) {
                    state.leftPhase ++;        

                    if (state.leftPhase >= 4 && state.dontOpenEyes) {
                        state.isClosingLeft = false;
                    }

                } else {
                    state.isClosingLeft = false;
                    state.leftPhase = 0;
                }

                state.leftEye = eyeStateFromPhase(state.leftPhase);
            }

            if (state.isClosingRight) {
                if (state.rightPhase < blinkTime) {
                    state.rightPhase ++;

                    if (state.rightPhase >= 4 && state.dontOpenEyes) {
                        state.isClosingRight = false;
                    }                

                } else {
                    state.isClosingRight = false;
                    state.rightPhase = 0;
                }

                state.rightEye = eyeStateFromPhase(state.rightPhase);
            }

            function eyeStateFromPhase(phase) {            

                if (phase < blinkTime / 2) {
                    return Math.min(4, phase + 1);
                } else if (phase >= blinkTime / 2) {

                    if (state.dontOpenEyes) {
                        return 4;
                    }

                    return Math.min(4, blinkTime - phase + 1);
                }
            }
        }

       startLoading();

        return {
            pause: pause,
            resume: resume,
            togglePause: togglePause,
            shutEyes: shutEyes,
            openEyes: openEyes,
            blink: blink,
            updateConfig: updateConfig,
            push: push,
            blow: blow
        };
    };

    function isNotSupported() {

        var testCanvas = document.createElement('canvas');
        testCanvas.width = 10;
        testCanvas.height = 10;
        var ctx = testCanvas && testCanvas.getContext('2d');

        if (!testCanvas || !ctx) {
            return 'No canvas context support';
        }
        
        return null;
    }

    function assert(c) {
        if (!c) {
            throw "Assertion failed";
        }
    }

    function log() {
        /*global console */
        if (window.console && console.log) {
            console.log.apply(console, arguments);
        }
    }

    function listen(node, eventName, callback) {
        if (node.addEventListener) {
            node.addEventListener(eventName, callback, false);
        } else if (node.attachEvent) {
            var fn = function() { return callback(window.event); };
            node.attachEvent('on' + eventName, fn);
        } else {
            throw "Cannot attach event handler";
        }
    }

    function getScrollY() {
        var docEl = document.documentElement || {},
            body = document.body || {};

        return docEl.scrollTop ||  body.scrollTop || 0;
    }

    function getWindowHeight() {
        var docEl = document.documentElement || {},
            body = document.body || {};        

        return docEl.clientHeight || body.clientHeight || 0;
    }

    function isVisible(image) {
        var p = image.getBoundingClientRect();
        return p.bottom >= 0 && p.top < getWindowHeight();
    }

    function saveState(name, value) {
        if (window.localStorage) {
            window.localStorage[name] = value;
        }
    }

    function loadState(name) {
        if (window.localStorage) {
            return window.localStorage[name];
        }
    }

})();