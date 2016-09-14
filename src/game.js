var canvas = null;
var ctx = null;
var background = {
    img: null,
    loaded: false,
    init: function () {
        var background = this;
        background.img = new Image();
        background.img.onload = function () {
            background.loaded = true;
        };
        background.img.src = 'src/map/forest/BG.png';
    }
};

var mapSettings = {
    tileSize: 128
};

var charSettings = {
    character: 'girl_ninja',
    jump: {
        duration: 26,
        speed: 32// 2^x
    },
    speed: 20,
    w: 50
};

var charState = {
    direction: 'Right',
    action: 'Idle',
    actionTime: 0,
    isJumping: false,
    isMoving: false,
    position: {
        x: null,
        y: null
    },
    positionOnMap: {
        x: null,
        y: null
    }
};

var mapState = {
    tiles: {}
};

var frame = 0;

var imgName;

var gMap = TILEDmap();
var gSpriteSheets = {};

var charSprite = SpriteSheetClass();
var mapSprite = SpriteSheetClass();

function xhrGet(url, callback) {
    var xmlhttp = new XMLHttpRequest();

    xmlhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            callback(this.responseText);
        }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
}

function TILEDmap() {
    var obj = {
        fullyLoaded: false,
        currMapData: null,

        numXTiles: 80,
        numYTiles: 50,
        
        shownXTiles: 0,
        shownYTiles: 0,

        tileSize: {
            x: 128,
            y: 128
        },

        pixelSize: {
            x: 128,
            y: 128
        },
        tileSets: [],

        load: function (map) {
            xhrGet(map, function (response) {
                obj.parseMapJSON(response);
            });
        },

        parseMapJSON: function (mapJSON) {
            this.currMapData = JSON.parse(mapJSON);

            var map = this.currMapData;
            this.numXTiles = map.width;
            this.numYTiles = map.height;
            this.tileSize.x = map.tilewidth;
            this.tileSize.y = map.tileheight;
            this.pixelSize.x = this.numXTiles * this.tileSize.x;
            this.pixelSize.y = this.numYTiles * this.tileSize.y;
            
            this.shownXTiles = Math.ceil(canvas.width / this.tileSize.x)+1;
            this.shownYTiles = Math.ceil(canvas.height / this.tileSize.y)+1;
            
            for(var i = 0; i < map.tilesets.length; i++){
                for (var tileKey in map.tilesets[i].tiles){
                    var id = map.tilesets[i].firstgid + parseInt(tileKey);

                    this.tileSets[id] = {
                        offset: map.tilesets[i].tileoffset !== undefined ? map.tilesets[i].tileoffset : {x: 0, y: 0},
                        img: this.parseImg(map.tilesets[i].tiles[tileKey].image)
                    };
                }
            }

            this.fullyLoaded = true;
        },

        parseImg: function (img) {
            return img.replace(/^.*[\\\/]/, '');
        }
    };

    return obj;
}

function SpriteSheetClass(){
    var obj = {
        img: null,
        url: '',
        sprites: [],
        loaded: false,

        init: function () {},

        load: function (imgName) {
            var img = new Image();
            img.onload = function () {
                obj.loaded = true;
            };
            img.src = imgName;
            this.img = img;
            this.url = imgName;
            gSpriteSheets[imgName] = this;
        },

        defSprite: function (name, x, y, w, h, cx, cy) {
            var spt = {
                "id": name,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "cx": cx == null ? 0 : cx,
                "cy": cy == null ? 0 : cy
            };
            this.sprites.push(spt);
        },

        parseAtlasDefinition: function(atlasJSON){
            var parsed = JSON.parse(atlasJSON);

            for(var key in parsed.frames){
                var sprite = parsed.frames[key];
                var cx = -sprite.frame.w * 0.5;
                var cy = -sprite.frame.h * 0.5;

                if(sprite.trimmed){
                    cx = sprite.spriteSourceSize.x - (sprite.spriteSourceSize.w * 0.5);
                    cy = sprite.spriteSourceSize.y - (sprite.spriteSourceSize.h * 0.5);
                }

                this.defSprite(sprite.filename, sprite.frame.x, sprite.frame.y, sprite.frame.w, sprite.frame.h, cx, cy);
            }
        },

        getStats: function (name) {
            for(var i = 0; i < this.sprites.length; i++){
                if(this.sprites[i].id == name) return this.sprites[i];
            }
            return null;
        }
    };

    return obj;
}

function drawSprite(spriteName, posX, posY) {
    for(var sheetName in gSpriteSheets){
        var sheet = gSpriteSheets[sheetName];
        var sprite = sheet.getStats(spriteName);
        if (sprite == null) continue;

        __drawSpriteInternal(sprite, sheet, posX, posY);

        return;
    }
}

function __drawSpriteInternal(spt, sheet, posX, posY) {
    if(spt == null || sheet == null) return;

    var hlf = {
        x: spt.cx,
        y: spt.cy
    };

    ctx.drawImage(sheet.img,
        spt.x, spt.y, spt.w, spt.h,
        posX + hlf.x, posY - spt.h,
        spt.w, spt.h
    );
}

function addListeners() {
    var controls = {
        37: 'Left',
        65: 'Left',
        39: 'Right',
        68: 'Right',
        38: 'Jump',
        87: 'Jump',
        40: 'Slide',
        83: 'Slide',
        70: 'Attack'
    };
    document.addEventListener('mousedown', function (event) {
        event.preventDefault();
        var action = event.button == 2 ? 'Throw' : 'Attack';
        if(charState.action !== action){
            charState.action = action;
            charState.actionTime = 10;
        }
    });
    document.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });
    document.addEventListener('keydown', function (event) {
        if(controls[event.keyCode] !== undefined){
            switch (controls[event.keyCode]){
                case 'Left':
                case 'Right':
                    if(!charState.actionTime){
                        charState.action = 'Run';
                    }
                    charState.isMoving = true;
                    charState.direction = controls[event.keyCode];
                    break;
                case 'Jump':
                    if(!charState.actionTime && checkGround()) {
                        charState.isJumping = true;
                    }
                case 'Slide':
                    if(!charState.actionTime && checkGround()) {
                        charState.action = controls[event.keyCode];
                        charState.actionTime = charSettings.jump.duration;
                    }
                    break;
                case 'Attack':
                    if(charState.action !== controls[event.keyCode]){
                        charState.action = controls[event.keyCode];
                        charState.actionTime = 10;
                    }
                    break;
            }
        }
    });
    document.addEventListener('keyup', function (event) {
        if(controls[event.keyCode] !== undefined){
            switch (controls[event.keyCode]){
                case 'Left':
                case 'Right':
                    if(!charState.actionTime){
                        charState.action = 'Idle';
                    }
                    charState.isMoving = false;
                    break;
                case 'Jump':
                case 'Slide':
                case 'Attack':
                    break;
            }
        }
    });

}

function animateJumpOrSlide(){
    var jumpFrame = charSettings.jump.duration - charState.actionTime;
    if(jumpFrame < 5){
        imgName = charState.action+'__00'+jumpFrame+'.png';
    }else if(charSettings.jump.duration - jumpFrame <= 6){
        imgName = charState.action+'__00'+(9 - (charSettings.jump.duration - jumpFrame) + 1)+'.png';
    }else{
        imgName = charState.action+'__004.png';
    }
    if(!--charState.actionTime){
        charState.action = (charState.isMoving) ? 'Run' : 'Idle';
        charState.isJumping = false;
    }
}

function animateRun() {
    imgName = charState.action+'__00'+frame+'.png';
}

function animateAction() {
    var actionFrame = 10 - charState.actionTime;
    imgName = charState.action+'__00'+actionFrame+'.png';
}

function animateCharacter() {
    if(!charSprite.loaded) return;
    frame = (++frame >= 10) ? 0 : frame;
    if(['Jump', 'Slide'].indexOf(charState.action) >= 0 && charState.actionTime){
        animateJumpOrSlide();
    }else if(['Attack', 'Throw'].indexOf(charState.action) >= 0  && charState.actionTime){
        animateAction();
    }else{
        animateRun();
    }

    if(charState.direction == 'Left'){
        imgName = 'Left'+imgName;
    }
    var offsetX = 0;
    var offsetY = 5;
    if(['Attack', 'Throw'].indexOf(charState.action) >= 0){
        if(charState.action == 'Attack'){
            offsetX = 30 * ((charState.direction == 'Left') ? -1 : 1);
            offsetY = 18;
        }
        if(!--charState.actionTime){
            charState.action = (charState.isMoving) ? 'Run' : 'Idle';
        }
    }
    drawSprite(imgName, charState.position.x + offsetX, charState.position.y + offsetY);
}

function checkCollision() {
    var direction = charState.direction,
        xTileCurrent = Math.floor(charState.positionOnMap.x / gMap.tileSize.x),
        xTile = xTileCurrent + (direction == 'Left' ? -1 : 1),
        yTile = Math.floor(charState.positionOnMap.y / gMap.tileSize.y) - 1,
        index = yTile * gMap.numXTiles + xTile,
        indexCurrent = yTile * gMap.numXTiles + xTileCurrent;
    if(mapState.tiles[indexCurrent] !== undefined){
        return true;
    }
    if(mapState.tiles[index] !== undefined){
        if(direction == 'Left'){
            if((mapState.tiles[index].x + gMap.tileSize.x * 0.5) >= (charState.position.x - charSettings.w * 0.5 - charSettings.speed)){
                return true;
            }
        }else{
            if((mapState.tiles[index].x - gMap.tileSize.x * 0.5) <= (charState.position.x + charSettings.w * 0.5 + charSettings.speed)){
                return true;
            }
        }
    }

    return false;
}

function checkGround() {
    var xTileL = Math.floor((charState.positionOnMap.x - charSettings.w * 0.5) / gMap.tileSize.x),
        xTileR = Math.floor((charState.positionOnMap.x + charSettings.w * 0.5) / gMap.tileSize.x),
        yTile = Math.ceil(charState.positionOnMap.y / gMap.tileSize.y),
        indexL = yTile * gMap.numXTiles + xTileL,
        indexR = yTile * gMap.numXTiles + xTileR;

    return (mapState.tiles[indexL] !== undefined && charState.position.y == (mapState.tiles[indexL].y - gMap.tileSize.y))
            || (mapState.tiles[indexR] !== undefined && charState.position.y == (mapState.tiles[indexR].y - gMap.tileSize.y));
}

// function checkRoof() {
//     var xTileL = Math.floor((charState.positionOnMap.x - charSettings.w * 0.5) / gMap.tileSize.x),
//         xTileR = Math.floor((charState.positionOnMap.x + charSettings.w * 0.5) / gMap.tileSize.x),
//         yTile = Math.ceil(charState.positionOnMap.y / gMap.tileSize.y) - 1,
//         indexL = yTile * gMap.numXTiles + xTileL,
//         indexR = yTile * gMap.numXTiles + xTileR;
//
//     return (mapState.tiles[indexL] !== undefined && charState.position.y <= (mapState.tiles[indexL].y + gMap.tileSize.y))
//             || (mapState.tiles[indexR] !== undefined && charState.position.y <= (mapState.tiles[indexR].y + gMap.tileSize.y));
// }

function checkRoof() {
    var xTile = Math.floor(charState.positionOnMap.x / gMap.tileSize.x),
        yTile = Math.floor(charState.positionOnMap.y / gMap.tileSize.y)-1,
        index = yTile * gMap.numXTiles + xTile;

    return !(mapState.tiles[index] === undefined || (charState.position.y - gMap.tileSize.y * 0.5) <= mapState.tiles[index].y);
}

function moveX() {
    var hlf = canvas.width * 0.5;
    var offset = charSettings.speed * ((charState.direction == 'Left') ? -1 : 1)
    charState.positionOnMap.x += offset;
    if(charState.position.x !== hlf
        || ((charState.positionOnMap.x - charSettings.speed) < hlf && charState.direction == 'Left')
        || ((gMap.pixelSize.x - charState.positionOnMap.x - charSettings.speed) < hlf && charState.direction == 'Right')
    ){
        charState.position.x += offset;
    }
}

function changePosition() {
    if(charState.isMoving){
        if((charState.position.x - charSettings.speed >= 0 || charState.direction == 'Right')
            && (charState.position.x + charSettings.speed <= canvas.width || charState.direction == 'Left')
            && !checkCollision()
        ){
            moveX();
        }
    }
    var chkGround = checkGround();
    var chkRoof = checkRoof();
    offset = 0;
    if(charState.actionTime >= (charSettings.jump.duration * 0.5) && charState.isJumping && !chkRoof){
        var direction = (charState.actionTime <= (charSettings.jump.duration * 0.5)) ? 1 : -1;
        offset = charSettings.jump.speed * direction;
    }else {
        if(!chkGround){
            offset = charSettings.jump.speed;
        }
        if(chkRoof){
            charState.action = (charState.isMoving) ? 'Run' : 'Idle';
            charState.isJumping = false;
            charState.actionTime = 0;
        }
    }

    charState.positionOnMap.y += offset;
    var fixedY = canvas.height - gMap.tileSize.y * 2;
    if(charState.position.y !== fixedY
        || ((canvas.height - (gMap.pixelSize.y - charState.positionOnMap.y)) > fixedY && !chkGround)
        || ((charState.positionOnMap.y + offset) < fixedY)
    ){
        charState.position.y += offset;
    }
}

function renderMap() {
    if(!mapSprite.loaded || !background.loaded || !gMap.fullyLoaded) return;
    ctx.drawImage(background.img, 0, 0, canvas.width, canvas.height);
    if(charState.positionOnMap.x == null){
        charState.positionOnMap.x = canvas.width * 0.5;
        charState.positionOnMap.y = gMap.pixelSize.y - mapSettings.tileSize*2;
        // charState.positionOnMap.x = gMap.pixelSize.x - mapSettings.tileSize*2;
        // charState.positionOnMap.y = gMap.pixelSize.y - mapSettings.tileSize*40;
    }

    var firstCol = Math.floor((charState.positionOnMap.x - charState.position.x) / gMap.tileSize.x);
    var firstRow = Math.floor((charState.positionOnMap.y - charState.position.y) / gMap.tileSize.y);

    for(var row = 0; row < gMap.shownYTiles; row++){
        for(var col = 0; col < gMap.shownXTiles; col++){
            var index = firstRow * gMap.numXTiles + firstCol + row * gMap.numXTiles + col;
            for(var layer = 0; layer < gMap.currMapData.layers.length; layer++){
                if(gMap.currMapData.layers[layer].data[index]){
                    var imgName = gMap.tileSets[gMap.currMapData.layers[layer].data[index]].img;
                    var offset = gMap.tileSets[gMap.currMapData.layers[layer].data[index]].offset;
                    var p = {
                        x: col * gMap.tileSize.x - ((charState.positionOnMap.x - charState.position.x) % gMap.tileSize.x) + gMap.tileSize.x*0.5,
                        y: row * gMap.tileSize.y - ((charState.positionOnMap.y - charState.position.y) % gMap.tileSize.y) + gMap.tileSize.y
                    };
                    if(gMap.currMapData.layers[layer].properties.reflection){
                        mapState.tiles[index] = p;
                    }
                    drawSprite(imgName, p.x + offset.x, p.y + offset.y);
                }

                if((row+1) == gMap.shownYTiles && (col+1) == gMap.shownXTiles && (layer + 1) == gMap.currMapData.layers.length){
                    changePosition();
                }
            }
        }
    }
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    renderMap();
    animateCharacter();
}

function initMap() {
    xhrGet('src/map/forest/forest.json', function (response) {
        mapSprite.parseAtlasDefinition(response);
        mapSprite.load('src/map/forest/forest.png');
    });
    gMap.load('src/map/forest/forest_map.json');
}

function initChar() {
    xhrGet('src/'+charSettings.character+'.json', function (response) {
        charSprite.parseAtlasDefinition(response);
        charSprite.load('src/'+charSettings.character+'.png');
    });

    charState.position.x = canvas.width * 0.5;
    charState.position.y = canvas.height - mapSettings.tileSize*2;
}

function setup() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    canvas.width = 1000;//window.innerWidth > 1000 ? window.innerWidth : 1000;
    canvas.height = 800*0.75;//window.innerHeight > 750 ? window.innerHeight : 750;

    background.init();

    initMap();
    initChar();

    addListeners();

    setInterval(animate, 1000/30);
}

setup();
