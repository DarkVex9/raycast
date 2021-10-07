var pi = Math.PI;
var exit = true;
exit = false;
var showMap = true;
var textureMap = true;
var frameTotal = 0;
var key = {};
var textOutput = [];
var outputBox = document.getElementById("outputBox");
print("Script Loaded");
/*«««««« ToDo / Notes to Self »»»»»»
	currently in the middle of adding support for transparent textures
  map doesn't show transparent textures
  transparent textures wometimes show as a translucent smear across the whole cell, sometime only show slivers of the cell
	
  maybe make rayCast build an ordered list of things to draw for a column on pixels then later instert entities before rendering?

	portals are working visually but the player does not get moved

  could maybe achieve sub cell geometry by scaling modX and modY (÷10?) and triggering a different set of collision rules. (rayX%1<0.9?)

  un-hardcode player movement
    which entity
    what system
      different components for different modes/games?
    keybindings?

  fix texture bleeding

  investigate corner going beyond cell edge

  realized that textures don't rotate around the sides of a cell but instead favor either north or south and east or west
    might want to change that? add a flag for that?

  fix remaining distortion, mostly near the edges of the screen at close distances.
  https://stackoverflow.com/questions/24173966/raycasting-engine-rendering-creating-slight-distortion-increasing-towards-edges
*/
//texture packer
//http://free-tex-packer.com/app/
/*
{
{{#rects}}  "{{{name}}}": {
    "x": {{frame.x}},
    "y": {{frame.y}},
    "w": {{frame.w}},
    "h": {{frame.h}}
  }{{^last}},{{/last}}
{{/rects}}
}
*/

//«««««« Map »»»»»»
var map = [[]];
var textbox = document.getElementById("textbox");
let mapCell = {
  texture: "wall1",
  textureNS: "wall1",
  textureEW: "wall1",
  walk: false,
  shoot: false,
  transparent: false,
  portalNS: { x: 3, y: 3, angle: pi },
  portalEW: { x: 3, y: 3, angle: pi },
  mirror: false,
  mirrorNS: false,
  mirrorEW: false
};
var mapData = { width: 10, height: 10 };
for (let y = 0; y < mapData.height; y++) {
  map[y] = [];
  for (let x = 0; x < mapData.width; x++) {
    map[y][x] = {};
  }
}
/*
map[1][4] = {
  portalNS: { x: 6, y: 5, angle: 0, mirrorX: false },
  portalEW: { x: 6, y: 5, angle: 0, mirrorX: false }
};
map[1][1] = { texture: "plant", transparent: true };
map[4][4] = { texture: "frameHalf", mirror: true };
map[4][3] = { texture: "frameHalf" };

//map[5][1] = { texture: "stripe2" };
//map[5][1] = { texture: "animated" };
map[5][1] = { textureNS: "stripe1", textureEW: "stone1" };
//map[5][1] = { textureNS: "animated", textureEW: "stone1" };

map[5][3] = { texture: "stone1" };
map[7][1] = { texture: "stripe1" };
map[6][3] = { texture: "stone1" };
*/
// map[5][0] = { texture: "stone1" };
map = JSON.parse(loadFile("maps/map01.json"));
//===rendering variables===
var canvas = document.getElementById("canvas1");
var ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
var mapCanvas = document.getElementById("mapCanvas");
var mapctx = mapCanvas.getContext("2d");
mapctx.imageSmoothingEnabled = true;
var gradient;
var textureSheet;
var texture = {};
var wallSize = 1.5;
var camera = {
  position: { x: 0, y: 0 },
  fov: pi / 2,
  pxPerRay: 1,
  maxDistance: 20,
  light: 3,
  fakeLight: 0.05,
  gradient: false
};
var mapCamera = { x: 5, y: 5, gridSize: 40 };
//«««««« Utility Functions »»»»»»
function splitVectorX(angle, magnitude = 1) {
  return Math.cos(angle) * magnitude;
}
function splitVectorY(angle, magnitude = 1) {
  return Math.sin(angle) * magnitude;
}
function print(message) {
  textOutput.push(Array.prototype.slice.call(arguments).join(" "));
  if (textOutput.length > 5) {
    textOutput.shift();
  }
  outputBox.value = textOutput.join("\n");
}
//«««««« Input Handeling »»»»»»
var player;
document.addEventListener("keydown", function (event) {
  let setTo = true;
  if (event.key === "w") {
    key.up = setTo;
  }
  if (event.key === "s") {
    key.down = setTo;
  }
  if (event.key === "a") {
    key.left = setTo;
  }
  if (event.key === "d") {
    key.right = setTo;
  }
  if (event.key === "ArrowLeft") {
    key.lookLeft = setTo;
  }
  if (event.key === "ArrowRight") {
    key.lookRight = setTo;
  }

  if (event.key === "p") {
    document.getElementById("textbox").value = JSON.stringify(map) + "\n";
    console.log(JSON.stringify(map));
  }
  /*if (event.key === "n") {
		player.noClip = !player.noClip;
		if (player.noClip) {
			print("noClip is now on");
		} else {
			print("noClip is now off");
		}
	}*/
  if (event.key === "o") {
    try {
      JSON.parse(textbox.value);
      map = JSON.parse(textbox.value);
      mapData.width = map[0].length;
      mapData.height = map.length;
      print("Map data loaded!");
    } catch {
      print("Error", "Can't parse map data");
      console.log("Error inputing map data - Cannot parse");
    }
  }
  if (event.key === "Escape") {
    if (exit) {
      exit = false;
      run();
    } else {
      exit = true;
    }
  }
});
document.addEventListener("keyup", function (event) {
  let setTo = false;
  if (event.key === "w") {
    key.up = setTo;
  }
  if (event.key === "s") {
    key.down = setTo;
  }
  if (event.key === "a") {
    key.left = setTo;
  }
  if (event.key === "d") {
    key.right = setTo;
  }
  if (event.key === "ArrowLeft") {
    key.lookLeft = setTo;
  }
  if (event.key === "ArrowRight") {
    key.lookRight = setTo;
  }
});
function updateMovement() {
  player.oldX = player.x;
  player.oldY = player.y;
  if (key.up && !key.down) {
    player.velocity.forward = 0.1;
  } else if (!key.up && key.down) {
    player.velocity.forward = -0.1;
  } else {
    player.velocity.forward = 0;
  }
  if (key.left && !key.right) {
    player.velocity.side = -0.1;
  } else if (!key.left && key.right) {
    player.velocity.side = 0.1;
  } else {
    player.velocity.side = 0;
  }
  if (key.lookLeft && !key.lookRight) {
    player.velocity.angle = -0.1;
  } else if (!key.lookLeft && key.lookRight) {
    player.velocity.angle = 0.1;
  } else {
    player.velocity.angle = 0;
  }
  /*
	if (!player.noClip) {
		if (
			map[Math.floor(player.y)][Math.floor(player.x)].hasOwnProperty("walk") &&
			!map[Math.floor(player.y)][Math.floor(player.x)].walk
		) {
			player.x = player.oldX;
			player.y = player.oldY;
		}
	}*/
  //if(map[Math.floor(player.y)][Math.floor(player.x)].hasOwnProperty("walk")&&!map[Math.floor(player.y)][Math.floor(player.x)].walk)
  //portal teleport code here
}

//«««««« Map Drawing Functions »»»»»»
function mapXToScreen(value) {
  return (
    value * mapCamera.gridSize -
    mapCamera.x * mapCamera.gridSize +
    mapCanvas.width / 2
  );
}
function mapYToScreen(value) {
  return (
    value * mapCamera.gridSize -
    mapCamera.y * mapCamera.gridSize +
    mapCanvas.height / 2
  );
}
function mapDrawLine(x1, y1, x2, y2, color = "#000") {
  let oldColor = mapctx.strokeStyle;
  mapctx.strokeStyle = color;
  mapctx.beginPath();
  mapctx.moveTo(mapXToScreen(x1), mapYToScreen(y1));
  mapctx.lineTo(mapXToScreen(x2), mapYToScreen(y2));
  mapctx.stroke();
  mapctx.strokeStyle = oldColor;
}
function mapDrawCircle(x, y, r, color = "#ccc") {
  let oldColor = mapctx.strokeStyle;
  mapctx.strokeStyle = color;
  mapctx.beginPath();
  mapctx.arc(
    mapXToScreen(x),
    mapYToScreen(y),
    r * mapCamera.gridSize,
    0,
    2 * Math.PI
  );
  mapctx.stroke();
  mapctx.strokeStyle = oldColor;
}
function mapDrawGrid() {
  for (let y = 0; y <= mapData.height; y++) {
    mapDrawLine(0, y, mapData.width, y);
  }
  for (let x = 0; x <= mapData.width; x++) {
    mapDrawLine(x, 0, x, mapData.height);
  }
}
function mapRender() {
  mapctx.clearRect(0, 0, canvas.width, canvas.height);
  mapDrawGrid();
  mapDrawCircle(camera.position.x, camera.position.y, 0.4);
  if (textureMap) {
    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        if (testStopRay(x, y)) {
          mapDrawTexture(map[y][x], x, y);
        }
      }
    }
  }
}
//«««««« Rendering »»»»»»
function initializeCamera() {
  camera.rays = canvas.width / camera.pxPerRay;
  camera.angleChange = camera.fov / camera.rays;
  camera.focalDistance = Math.floor(camera.rays / 2 / Math.tan(camera.fov / 2)); //Math.floor() used to round off values like 200.00000000000003 and allow integer operations, consider removing to make more mathematically correct
  //removing Math.floor() doesn't seem to make a difference in a side by side test
  //camera.focalDistance = camera.rays / 2 / Math.tan(camera.fov / 2);
}
function castRay(
  x,
  y,
  currentAngle,
  referenceAngle = currentAngle,
  startDistance = 0,
  startCellList = []
) {
  let rayX = 0;
  let rayY = 0;
  let tanAngle = 0;
  let modX = 0;
  let modY = 0;
  let floorX = 0;
  let floorY = 0;
  let distance = startDistance;
  let cellList = JSON.parse(JSON.stringify(startCellList));
  let modDistance = Math.abs(
    (1 / Math.sin(currentAngle)) * Math.cos(referenceAngle - currentAngle)
  );
  let startX = 0;
  let startY = 0;
  if (currentAngle % (2 * pi) < pi) {
    tanAngle = Math.tan(currentAngle); //tan probably should not be defined differently on top and bottom
    rayY = Math.floor(y) + 1.01; //check these offsets!
    rayX = x - (y - rayY) / tanAngle;
    modY = 1;
    //mapDrawCircle(0.5, 0.5, 1, "#F00");
  }
  if (currentAngle % (2 * pi) > pi) {
    tanAngle = Math.tan(pi - currentAngle); //tan probably should not be defined differently on top and bottom
    rayY = Math.floor(y) - 0.01; //check these offsets!
    rayX = x + (y - rayY) / tanAngle;
    modY = -1;
    //mapctx.strokeStyle = "#00F";
    // mapDrawCircle(0.5, 0.5, 1, "#00F");
  }
  distance =
    startDistance + Math.sqrt(Math.pow(x - rayX, 2) + Math.pow(y - rayY, 2));
  startX = rayX;
  startY = rayY;
  let lineSteps = [x, y];
  modX = 1 / tanAngle;
  // mapDrawLine(rayX, rayY, rayX + modX, rayY + modY, "#f0f");
  floorX = Math.floor(rayX);
  floorY = Math.floor(rayY);
  if (testPartialRender(floorX, floorY)) {
    cellList.unshift({
      cell: getCell(floorX, floorY),
      distance: distance,
      opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
      subposition: ((rayX % 1) + 1) % 1,
      NS: true
    });
    mapDrawCircle(rayX, rayY, 0.1, "#fff");
  }
  let iteration = 0;
  while (
    distance < camera.maxDistance &&
    rayX > 0 &&
    rayY > 0 &&
    rayX < mapData.width &&
    rayY < mapData.height &&
    !(
      testStopRay(floorX, floorY) ||
      map[floorY][floorX].hasOwnProperty("portalNS") ||
      map[floorY][floorX].hasOwnProperty("portalEW")
    )
  ) {
    // if (i === 0) {
    //   console.log("currentCell: ", currentCell);
    // }
    /*
		if (currentCell.hasOwnProperty("portalNS")) {
			lineSteps[lineSteps.length] = rayX;
			lineSteps[lineSteps.length] = rayY;
			rayX = currentCell.portalNS.x + (rayX % 1);
			rayY = currentCell.portalNS.y + (rayY % 1);
			lineSteps[lineSteps.length] = rayX;
			lineSteps[lineSteps.length] = rayY;
			mapctx.strokeStyle = "#ff0";
		}
		*/
    rayY += modY;
    rayX += modX;
    if (iteration === 0) {
      modDistance = Math.sqrt(
        Math.abs(Math.pow(startX - rayX, 2) + Math.pow(startY - rayY, 2))
      );
    }
    distance += modDistance;
    iteration++;
    //mapDrawCircle(rayX, rayY, 0.04, "#80f");
    floorX = Math.floor(rayX);
    floorY = Math.floor(rayY);
    if (testPartialRender(floorX, floorY)) {
      cellList.unshift({
        cell: getCell(floorX, floorY),
        distance: distance,
        opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
        subposition: ((rayX % 1) + 1) % 1,
        NS: true
      });
      mapDrawCircle(rayX, rayY, 0.1, "#fff");
    }
  }
  cellList.unshift({
    cell: getCell(floorX, floorY),
    distance: distance,
    opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
    subposition: ((rayX % 1) + 1) % 1,
    NS: true
  });
  lineSteps[lineSteps.length] = rayX;
  lineSteps[lineSteps.length] = rayY;
  //mapDrawJumpPath(lineSteps);
  //mapDrawCircle(rayX, rayY, 0.1, "#c00");
  let horizontalX = rayX;
  let horizontalY = rayY;
  let horizontalDistance = distance;
  let horizontalSteps = lineSteps;
  let horizontalCellList = cellList;
  cellList = startCellList;
  distance = startDistance;
  modDistance =
    (1 / Math.sin(currentAngle)) * Math.cos(referenceAngle - currentAngle);
  //mapctx.strokeStyle = "#F00";
  if (
    currentAngle % (2 * pi) < pi * 0.5 ||
    currentAngle % (2 * pi) > pi * 1.5
  ) {
    tanAngle = Math.tan(currentAngle); //tan probably should not be defined differently on top and bottom
    rayX = Math.floor(x) + 1.01; //check these offsets!
    rayY = y - (x - rayX) * tanAngle;
    modX = 1;
    //mapctx.strokeStyle = "#00F";
    //mapDrawCircle(0.5, 0.5, 1, "#00F");
  }
  if (
    currentAngle % (2 * pi) > 0.5 * pi &&
    currentAngle % (2 * pi) < 1.5 * pi
  ) {
    tanAngle = Math.tan(pi - currentAngle); //tan probably should not be defined differently on top and bottom
    rayX = Math.floor(x) - 0.01; //check these offsets!
    rayY = y + (x - rayX) * tanAngle;
    modX = -1;
    //mapctx.strokeStyle = "#0F0";
    //mapDrawCircle(0.5, 0.5, 1, "#0F0");
  }
  distance =
    startDistance + Math.sqrt(Math.pow(x - rayX, 2) + Math.pow(y - rayY, 2));
  // if (i === 1) {
  //   console.log(rayX, rayY);
  // }]
  //mapDrawCircle(rayX, rayY, 0.1, "#f0f");
  lineSteps = [x, y];
  modY = tanAngle;
  //mapDrawLine(rayX, rayY, rayX + modX, rayY + modY, "#ff0");
  floorX = Math.floor(rayX);
  floorY = Math.floor(rayY);
  if (testPartialRender(floorX, floorY)) {
    cellList.unshift({
      cell: getCell(floorX, floorY),
      distance: distance,
      opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
      subposition: ((rayX % 1) + 1) % 1,
      NS: true
    });
    mapDrawCircle(rayX, rayY, 0.1, "#fff");
  }
  iteration = 0;
  startX = rayX;
  startY = rayY;
  while (
    distance < camera.maxDistance &&
    rayX > 0 &&
    rayY > 0 &&
    rayX < mapData.width &&
    rayY < mapData.height &&
    !(
      testStopRay(floorX, floorY) ||
      map[floorY][floorX].hasOwnProperty("portalNS") ||
      map[floorY][floorX].hasOwnProperty("portalEW")
    )
  ) {
    // if (i === 0) {
    //   console.log("currentCell: ", currentCell);
    // }
    /*
		if (currentCell.hasOwnProperty("portalEW")) {
			lineSteps[lineSteps.length] = rayX;
			lineSteps[lineSteps.length] = rayY;
			rayX = currentCell.portalEW.x + (rayX % 1);
			rayY = currentCell.portalEW.y + (rayY % 1);
			lineSteps[lineSteps.length] = rayX;
			lineSteps[lineSteps.length] = rayY;
			mapctx.strokeStyle = "#ff0";
		}
		*/
    rayY += modY;
    rayX += modX;
    if (iteration === 0) {
      modDistance = Math.sqrt(
        Math.pow(startX - rayX, 2) + Math.pow(startY - rayY, 2)
      );
    }
    distance += modDistance;
    iteration++;
    //mapDrawCircle(rayX, rayY, 0.04, "#80f");
    floorX = Math.floor(rayX);
    floorY = Math.floor(rayY);
    if (testPartialRender(floorX, floorY)) {
      cellList.unshift({
        cell: getCell(floorX, floorY),
        distance: distance,
        opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
        subposition: ((rayY % 1) + 1) % 1,
        NS: false
      });
      mapDrawCircle(rayX, rayY, 0.1, "#fff");
    }
  }
  cellList.unshift({
    cell: getCell(floorX, floorY),
    distance: distance,
    opticalDistance: distance * Math.cos(referenceAngle - currentAngle),
    subposition: ((rayY % 1) + 1) % 1,
    NS: false
  });
  lineSteps[lineSteps.length] = rayX;
  lineSteps[lineSteps.length] = rayY;
  let colorDistance = 0;
  let rayHit = 0;
  let rayNS = false;
  if (distance < horizontalDistance) {
    if (showMap) {
      mapDrawJumpPath(lineSteps);
      mapDrawCircle(rayX, rayY, 0.1, "#fff");
    }
    colorDistance = 250 - distance * 15;
    rayHit = ((rayY % 1) + 1) % 1;
  } else {
    rayNS = true;
    if (showMap) {
      mapDrawJumpPath(horizontalSteps);
      mapDrawCircle(horizontalX, horizontalY, 0.1, "#fff");
    }
    rayX = horizontalX;
    rayY = horizontalY;
    distance = horizontalDistance;
    cellList = horizontalCellList;
    colorDistance = 250 - distance * 15 - 20;
    rayHit = ((rayX % 1) + 1) % 1;
  }
  let cell = getCell(rayX, rayY);
  if (rayNS && cell.hasOwnProperty("portalNS")) {
    mapctx.strokeStyle = "#FF0";
    let passAngle = currentAngle;
    if (cell.portalEW.mirrorX) {
      passAngle = pi - passAngle;
    }
    return castRay(
      (((rayX % 1) + 1) % 1) + cell.portalNS.x,
      (((rayY % 1) + 1) % 1) + cell.portalNS.y,
      passAngle,
      referenceAngle,
      distance,
      cellList
    );
  } else if (!rayNS && cell.hasOwnProperty("portalEW")) {
    mapctx.strokeStyle = "#FF0";
    let passAngle = currentAngle;
    if (cell.portalEW.mirrorX) {
      passAngle = pi - passAngle;
    }
    return castRay(
      (((rayX % 1) + 1) % 1) + cell.portalEW.x,
      (((rayY % 1) + 1) % 1) + cell.portalEW.y,
      passAngle,
      referenceAngle,
      distance,
      cellList
    );
  } else {
    mapctx.strokeStyle = "#F00";
    return cellList;
  }
}
function render() {
  if (camera.gradient) {
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  //https://permadi.com/1996/05/ray-casting-tutorial-7/
  let currentAngle =
    (((camera.position.angle - camera.fov / 2) % (2 * pi)) + 2 * pi) % (2 * pi);
  //ang = atan( ( pixel x coord - half screen width ) / dist to projection surface );
  //horizontal intersections
  for (let rayIndex = 0; rayIndex < camera.rays; rayIndex++) {
    let hit = castRay(
      camera.position.x,
      camera.position.y,
      currentAngle,
      camera.position.angle
    );
    // currentAngle =
    //   camera.position.angle +
    //   Math.atan(
    //     (i * camera.pxPerRay - canvas.width * camera.pxPerRay) /
    //       camera.focalDistance
    //   );

    //mapDrawCircle(rayX, rayY, 0.1, "#00c");
    //distance = distance * Math.cos(camera.position.angle - currentAngle);

    /*if (frameTotal === 10) {
      console.log("old: " + distance);
    }*/
    /*if (frameTotal === 10) {
      console.log("new: " + distance + "\n");
    }*/
    //ctx.fillStyle = "rgb(" + colorDistance + ",0,0)";
    //"rbg(" + colorDistance + "," + colorDistance + "," + colorDistance + ")";
    // ctx.fillRect(
    //   i * camera.pxPerRay,
    //   canvas.height / 2 - columnHeight / 2,
    //   camera.pxPerRay,
    //   columnHeight
    // );
    for (let i = 0; i < hit.length; i++) {
      let columnHeight =
        (wallSize / hit[i].opticalDistance) *
        camera.focalDistance *
        camera.pxPerRay;
      if (
        hit[i].cell.hasOwnProperty("texture") ||
        (hit[i].NS && hit[i].cell.hasOwnProperty("textureNS")) ||
        (!hit[i].NS && hit[i].cell.hasOwnProperty("textureEW"))
      ) {
        drawTexture(
          hit[i].cell,
          rayIndex * camera.pxPerRay,
          columnHeight,
          hit[i].subposition,
          hit[i].NS,
          Math.max(
            Math.min(
              1 /
                (hit[i].distance / camera.light - hit[i].NS * camera.fakeLight),
              1
            ),
            0.1
          )
        );
      }
    }

    /*
    ctx.beginPath();
    ctx.rect(
      i * camera.pxPerRay,
      canvas.height / 2 - columnHeight,
      camera.pxPerRay,
      canvas.height / 2 + columnHeight
    );
    ctx.stroke();
    */
    // mapDrawLine(
    //   camera.position.x,
    //   camera.position.y,
    //   camera.position.x + splitVectorX(currentAngle, distance),
    //   camera.position.y + splitVectorY(currentAngle, distance),
    //   "#00f"
    // );
    // mapDrawLine(
    //   camera.position.x,
    //   camera.position.y,
    //   camera.position.x + splitVectorX(currentAngle, horizontalDistance),
    //   camera.position.y + splitVectorY(currentAngle, horizontalDistance),
    //   "#f00"
    // );
    currentAngle += camera.angleChange;
  }
  if (frameTotal < 5 * 20 && frameTotal % 20 === 0) {
    //console.log(problemRays);
  }
  if (showMap) {
    mapDrawCircle(camera.position.x, camera.position.y, 0.2, "#0f0");
  }
  if (showMap) {
    let a = camera.position.angle;
    mapDrawLine(
      camera.position.x,
      camera.position.y,
      camera.position.x + splitVectorX(a, 0.3),
      camera.position.y + splitVectorY(a, 0.3),
      "#0f0"
    );
    mapDrawLine(
      camera.position.x,
      camera.position.y,
      camera.position.x + splitVectorX(a + camera.fov / 2, 0.4),
      camera.position.y + splitVectorY(a + camera.fov / 2, 0.4),
      "#0f0"
    );
    mapDrawLine(
      camera.position.x,
      camera.position.y,
      camera.position.x + splitVectorX(a - camera.fov / 2, 0.4),
      camera.position.y + splitVectorY(a - camera.fov / 2, 0.4),
      "#0f0"
    );
  }
}
function getCell(x, y) {
  let cell;
  let floorX = Math.floor(x);
  let floorY = Math.floor(y);
  if (testInBounds(floorX, floorY)) {
    cell = map[floorY][floorX];
  } else {
    cell = {
      texture: "textures/void",
      walk: false,
      shoot: false,
      transparent: false
    };
  }
  return cell;
}
function testInBounds(x, y) {
  return !(x < 0 || y < 0 || x >= mapData.width || y >= mapData.height);
}
function testStopRay(x, y) {
  if (!testInBounds(x, y)) {
    return false;
  }
  let currentCell = map[y][x];
  return (
    (currentCell.hasOwnProperty("texture") ||
      currentCell.hasOwnProperty("textureNS") ||
      currentCell.hasOwnProperty("textureEW")) &&
    (!currentCell.hasOwnProperty("transparent") || !currentCell.transparent)
  );
}
function testPartialRender(x, y) {
  if (x < 0 || y < 0 || x >= mapData.width || y >= mapData.height) {
    return false;
  }
  let currentCell = map[y][x];
  return currentCell.hasOwnProperty("texture") && currentCell.transparent;
}
function mapDrawJumpPath(path) {
  mapctx.beginPath();
  for (let i = 0; i < path.length; i += 4) {
    mapctx.moveTo(mapXToScreen(path[i]), mapYToScreen(path[i + 1]));
    mapctx.lineTo(mapXToScreen(path[i + 2]), mapYToScreen(path[i + 3]));
  }
  mapctx.stroke();
}
function drawTexture(cell, x, height, textureX, NS, shading) {
  let data;
  let textureName;
  if (NS && cell.hasOwnProperty("textureNS")) {
    textureName = cell.textureNS;
  } else if (!NS && cell.hasOwnProperty("textureEW")) {
    textureName = cell.textureEW;
  } else {
    textureName = cell.texture;
  }
  if (cell.mirror === true || (NS && cell.mirrorNS) || (!NS && cell.mirrorEW)) {
    textureX = 1 - textureX;
  }
  if (texture.hasOwnProperty(textureName)) {
    if (typeof texture[textureName] === "function") {
      data = texture[textureName]();
    } else {
      data = texture[textureName];
    }
  } else {
    data = texture["textures/error"];
  }
  try {
    ctx.drawImage(
      textureSheet,
      data.x + textureX * data.w,
      data.y,
      1,
      data.h,
      x,
      canvas.height / 2 - height / 2,
      camera.pxPerRay,
      height
    );
    ctx.globalAlpha = 1 - shading;
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, canvas.height / 2 - height / 2, camera.pxPerRay, height);
  } catch {
    print("missing texture", textureName);
  }
  ctx.globalAlpha = 1;
}
function mapDrawTexture(cell, x, y) {
  let data = texture[cell.texture];
  let data2;
  let drawWidth = 1;
  if (cell.hasOwnProperty("textureNS")) {
    data = texture[cell.textureNS];
    drawWidth = 0.5;
    if (cell.hasOwnProperty("textureEW")) {
      data2 = texture[cell.textureEW];
    } else {
      data2 = texture[cell.texture];
    }
  } else if (cell.hasOwnProperty("textureEW")) {
    data = texture[cell.texture];
    drawWidth = 0.5;
    data2 = texture[cell.textureEW];
  }
  mapctx.drawImage(
    textureSheet,
    data.x,
    data.y,
    data.w,
    data.h,
    x * mapCamera.gridSize,
    y * mapCamera.gridSize,
    mapCamera.gridSize * drawWidth,
    mapCamera.gridSize
  );
  if (data2) {
    mapctx.drawImage(
      textureSheet,
      data2.x,
      data2.y,
      data2.w,
      data2.h,
      (x + 1 - drawWidth) * mapCamera.gridSize,
      y * mapCamera.gridSize,
      mapCamera.gridSize * drawWidth,
      mapCamera.gridSize
    );
  }
  /*
  let data;
  let textureName;
  let mirror = false;
  if (cell.hasOwnProperty("textureNS")) {
    if (cell.mirror || cell.mirrorNS) {
      mirror = true;
    }
    textureName = cell.textureNS;
    if (cell.hasOwnProperty("textureEW")) {
      textureName = cell.textureNS;
    } else {
    }
  } else {
    textureName = cell.texture;
  }
  if (cell.mirror === true || cell.mirrorNS) {
    // || (!NS && cell.mirrorEW)) {
    textureX = 1 - textureX;
  }
  if (texture.hasOwnProperty(textureName)) {
    if (typeof texture[textureName] === "function") {
      data = texture[textureName]();
    } else {
      data = texture[textureName];
    }
  } else {
    data = texture["error"];
  }*/
}

//trying to get data from the contents of a text file, running into problems with async and how I tend to structure things. to be dealt with later
/*
function getText(path = "./file.txt") {
  fetch(path)
    .then(function (response) {
      return response;
    })
    .then(function (data) {
      return data.text();
    })
    .catch(function (err) {
      console.log("Fetch problem show: " + err.message);
    });
}
*/

//«««««« Entities »»»»»»
var ent = {};
var totalEnts = 0;

function createEnt(entName = "ent_Generic") {
  let id = ++totalEnts;
  let object = { id: id, name: entName };
  for (let i = 1; i < arguments.length; i++) {
    component[arguments[i]].add(object);
  }
  ent[id] = object;
  return object;
}

//«««««« components »»»»»»
var component = {};
var updatingComponents = [];
function addRequirement(object, requires) {
  for (let i = 0; i < requires.length; i++) {
    if (!object.hasOwnProperty(requires[i])) {
      component[requires[i]].add(object);
    }
  }
}
function initializeComponents() {
  Object.keys(component).forEach(function (key, index) {
    // key: the name of the object key
    // index: the ordinal position of the key within the object
    if (
      component[key].hasOwnProperty("update") &&
      updatingComponents.indexOf(key) === -1
    ) {
      updatingComponents.push(key);
    }
  });
}
function updateComponents() {
  for (let i = 0; i < updatingComponents.length; i++) {
    component[updatingComponents[i]].update();
  }
}
//--position--
component.position = new Component("position", false);
component.position.description = "stores x, y, and angle coordinates";
component.position.add = function (object, x = 0, y = 0, angle = 0) {
  object.position = {};
  object.position.x = x;
  object.position.y = y;
  object.position.angle = angle;
};

//--velocity--
component.velocity = new Component("velocity", true);
component.velocity.description =
  "stores x and y velocity, update changes position acordingly";
component.velocity.requires = ["position"];
component.velocity.add = function (
  object,
  x = 0,
  y = 0,
  angle = 0,
  forward = 0,
  side = 0,
  doUpdate = true
) {
  object.velocity = {};
  object.velocity.x = x;
  object.velocity.y = y;
  object.velocity.angle = angle;
  object.velocity.forward = forward;
  object.velocity.side = side;
  if (doUpdate) {
    this.startUpdate(object);
  }
  addRequirement(object, this.requires);
};
component.velocity.update = function () {
  for (let i = 0; i < this.updateList.length; i++) {
    let object = ent[this.updateList[i]];
    object.position.x +=
      object.velocity.x +
      splitVectorX(object.position.angle, object.velocity.forward) +
      splitVectorX(object.position.angle + pi / 2, object.velocity.side);
    object.position.y +=
      object.velocity.y +
      splitVectorY(object.position.angle, object.velocity.forward) +
      splitVectorY(object.position.angle + pi / 2, object.velocity.side);
    object.position.angle += object.velocity.angle;
  }
};
//--gravity--
component.gravity = {
  description: "static acceleration to provided variable",
  add: function (
    object,
    strength = 1,
    variable = ["velocity"]["y"],
    doUpdate = true
  ) {
    object.gravity = {};
    object.gravity.force = strength;
    object.gravity.variable = variable;
    if (doUpdate) {
      this.startUpdate(object);
    }
  },
  remove: function (object) {
    this.stopUpdate(object);
    delete object.gravity;
  },
  update: function () {
    for (let i = 0; i < this.updateList.length; i++) {
      let object = ent[this.updateList[i]];
      object[object.gravity.variable[0]][object.gravity.variable[1]] +=
        object.gravity.force;
    }
  },
  startUpdate: function (object) {
    this.updateList.push(object.id);
  },
  stopUpdate: function (object) {
    this.updateList.splice(this.updateList.indexOf(object.id), 1);
  },
  updateList: []
};

//--Component Constructor--
function Component(technicalName, update = false) {
  this.technicalName = technicalName;
  this.description = "default description";
  this.requires = [];
  if (update) {
    this.add = function (object, doUpdate = true) {
      object[this.technicalName] = {};
      if (doUpdate) {
        this.startUpdate(object);
      }
      addRequirement(object, this.requires);
    };
    this.remove = function (object) {
      this.stopUpdate(object);
      delete object[this.technicalName];
    };
    this.update = function () {
      for (let i = 0; i < this.updateList.length; i++) {
        let object = ent[this.updateList[i]];
        object[object.template.variable[0]][object.template.variable[1]] +=
          object.template.data;
      }
    };
    this.startUpdate = function (object) {
      this.updateList.push(object.id);
    };
    this.stopUpdate = function (object) {
      this.updateList.splice(this.updateList.indexOf(object.id), 1);
    };
    this.updateList = [];
  } else {
    this.add = function (object) {
      object[this.technicalName] = {};
      addRequirement(object, this.requires);
    };
    this.remove = function (object) {
      delete object[this.technicalName];
    };
  }
}

//--square renderer--
//
function gridTexture(
  x,
  y,
  width = 64,
  height = width,
  gridSizeWidth = width,
  gridSizeHeight = gridSizeWidth
) {
  return {
    x: x * gridSizeWidth,
    y: y * gridSizeHeight,
    width: width,
    height: height
  };
}
//«««««« Test Code »»»»»»//
window.addEventListener("DOMContentLoaded", initialize());
function initialize() {
  textureSheet = document.getElementById("textures");
  /*
  texture.error = gridTexture(4, 3);
  texture.void = gridTexture(4, 3);
  texture.stone1 = gridTexture(0, 0);
  texture.stone1b = gridTexture(2, 0);
  texture.stoneDoor = gridTexture(0, 1);
  texture.stone2 = gridTexture(1, 0);
  texture.stone2b = gridTexture(3, 0);
  texture.stone3 = gridTexture(4, 0);
  texture.stripe1 = gridTexture(1, 1);
  texture.stripe2 = gridTexture(2, 1);
  texture.stripe4 = gridTexture(3, 1);
  texture.stripe3 = gridTexture(4, 1);
  texture.cobble1 = gridTexture(3, 2);
  texture.cobble1b = gridTexture(2, 3);
  texture.cobble2 = gridTexture(0, 2);
  texture.cobble3 = gridTexture(1, 2);
  texture.brick1 = gridTexture(2, 2);
  texture.brick1b = gridTexture(4, 2);
  texture.red1 = gridTexture(4, 3);
  texture.wood1 = gridTexture(0, 3);
  texture.wood2 = gridTexture(1, 3);
  texture.window1 = gridTexture(3, 3);
  texture.cloth1 = gridTexture(5, 4);
  texture.cloth1b = gridTexture(5, 3);
  texture.frame1 = gridTexture(2, 5, 128, 128, 64);
  texture.frame2 = gridTexture(0, 7, 128, 128, 64);
  texture.frameHalf = gridTexture(4, 7, 64, 128, 64);
  texture.frameStone1 = gridTexture(0, 5, 128, 128, 64);
  texture.frameStone2 = gridTexture(2, 7, 128, 128, 64);
  texture.frameStoneHalf = gridTexture(4, 5, 64, 128, 64);
  texture.animated = function () {
    if (frameTotal % 20 < 10) {
      return gridTexture(1, 0);
    } else {
      return gridTexture(3, 0);
    }
    // if (Math.random() > 0.5) {
    //   return gridTexture(1, 0);
    // } else {
    //   return gridTexture(3, 0);
    // }
  };
  texture.shadow1 = gridTexture(4, 1);
  texture.banner1 = gridTexture(4, 0);
*/
  //console.log(document.getElementById("textureData").data);
  texture = JSON.parse(loadFile("textures.json"));
  initializeComponents();
  initializeCamera();
  print(camera.focalDistance);
  gradient = ctx.createRadialGradient(
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height),
    1,
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height),
    Math.floor(canvas.height / 2)
  );
  gradient.addColorStop(0, "#666");
  gradient.addColorStop(1, "#000");
  player = createEnt("player");
  component.position.add(player, 2.5, 2.7, 0.0 * pi);
  //component.position.add(player, 2.32, 4.16, 0.87);
  component.velocity.add(player, 0, 0, -0.1, 0.0);
  camera.position = player.position;
  /*
let thing = createEnt("testThing", "position", "velocity");
ent[thing.id] = thing;
*/
  let thing2 = createEnt("thing2");
  component.velocity.add(thing2, 0, 0, 0, true);
  component.gravity.add(thing2, 1, ["velocity", "y"], true);
  print("Ready");
  run();
}
function loadFile(filePath) {
  var result = null;
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", filePath, false);
  xmlhttp.send();
  if (xmlhttp.status == 200) {
    result = xmlhttp.responseText;
  }
  return result;
}
function run() {
  if (showMap) {
    mapRender();
  }
  render();
  print("Program Started");
  var interval = setInterval(function () {
    try {
      updateMovement();
      updateComponents();
      if (showMap) {
        mapRender();
      }
      render();
      if (exit) {
        clearInterval(interval);
        print("Program Stopped");
      }
      frameTotal++;
    } catch (error) {
      clearInterval(interval);
      console.log(error);
    }
  }, 50);
}

/*
var intervalCount = 20;
var interval = setInterval(function () {
  updateComponents();
  console.log(thing2.position);
  if (intervalCount <= 0) {
    clearInterval(interval);
  }
  intervalCount--;
}, 1000);
*/

//http://free-tex-packer.com/app/
/*
{
{{#rects}}  "{{{name}}}": {
    "x": {{frame.x}},
    "y": {{frame.y}},
    "w": {{frame.w}},
    "h": {{frame.h}}
  }{{^last}},{{/last}}
{{/rects}}
}
*/
