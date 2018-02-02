(function () {
    window.startWatching = function (image, cfg) {
        var lastScrollPos = getScrollY();
        var lastTime = +new Date;
        var isReplaced = false;
        var nodes;
        var thresh = 12;
        var avgSpeed = 0;
        var wasVisible = false;

        listen(window, 'scroll', function () {
            var pos = getScrollY();
            var t = +new Date;

            if (pos != lastScrollPos) {
                var dy = (pos - lastScrollPos) / ( t - lastTime);                
                lastScrollPos = pos;
                lastTime = t;
                var isNowVisible = isReplaced && isVisible(nodes.base);

                //log("Is visible: " + isVisible(nodes.base) + ", pos = " + lastScrollPos + ', dy = ' + dy);

                //if (isReplaced && (Math.abs(dy) > thresh) && !isVisible(nodes.base)) {
                if (isNowVisible != wasVisible && !isNowVisible) {
                    updatePiece(0.6);
                }

                wasVisible = isNowVisible;
            }
        });

        if (image.height > 0) {
            nodes = replaceImage(image, cfg);
            isReplaced = true;
            updatePiece(0.8);
        } else {
            image.onload = function () {
                nodes = replaceImage(image, cfg);
                isReplaced = true;
                updatePiece(0.8);
            };
        }

        function updatePiece(prob) {
            var r = Math.random() > prob;
            setVisible(nodes.piece, r);
            setVisible(nodes.piece2, !r);
            // log("Set to " + r);
        }
    };

    function log() {
        /*global console */
        if (window.console && console.log) {
            console.log.apply(console, arguments);
        }
    }

    function setVisible(node, is) {
        node.style.display = is ? '' : 'none';
    }

    function isVisible(image) {
        var p = image.getBoundingClientRect();
        return p.bottom >= 0 && p.top < getWindowHeight();
    }

    function replaceImage(image, cfg) {
        var div = image.ownerDocument.createElement('div'),
            div2 = image.ownerDocument.createElement('div'),
            div3 = image.ownerDocument.createElement('div');

        var w = image.width,
            h = image.height,
            src = image.src;

        div.style.cssText = 'display: inline-block; position: relative; ' + 
            'width: ' + w + 'px; height: ' + h + 'px;' + 
            'background: url("' + src + '") no-repeat 0 0; border-bottom: 1px solid #999;';
        div2.style.cssText = 'position: absolute; top: ' + cfg.y + 'px; left: ' + cfg.x + 'px;' + 
            'width: ' + cfg.w + 'px; height: ' + cfg.h + 'px; display: none;' + 
            'background: url("' + cfg.pieceSrc + '") no-repeat 0 0';

        div3.style.cssText = 'position: absolute; background: white; left: ' + cfg.x2 + 'px; ' + 
            'top: ' + cfg.y2 + 'px; width: ' + cfg.w2 +'px; height: ' + cfg.h2 + 'px;'; 
        div.appendChild(div2);
        div.appendChild(div3);

        image.parentNode.replaceChild(div, image);
        return { base: div, piece: div2, piece2: div3};
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
})();