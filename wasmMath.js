var Module = {};
function loadWASM () {
  const cMath = {};
  return new Promise((resolve, reject) => {
    fetch('cMath.wasm')
        .then(response => {
          return response.arrayBuffer();
        })
        .then(buffer => {
            Module.wasmBinary = buffer;

            var script = document.createElement('script');
            script.src = 'cMath.js';

            script.onload = function () {
              if (!WebAssembly.instantiate) {
                console.log('couldnt load WASM');
                let newObj = { test: "this is working" };
                reject(newObj);
              }
              console.log('Emscripten boilerplate loaded.');
              
              cMath['doubler'] = _doubler;
              cMath['fib'] = _fib;

              //filters
              cMath['grayScale'] = function(array) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._grayScale(mem, array.length);
                const grayScaled = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return grayScaled;
              };
              cMath['sobelFilter'] = function(array, width, height) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._sobelFilter(mem, width, height);
                const filtered = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return filtered;
              };
              cMath['brighten'] = function(array, brightness = 25) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._brighten(mem, array.length, brightness);
                const brighten = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return brighten;
              };
              cMath['invert'] = function(array) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._invert(mem, array.length);
                const invert = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return invert;
              };
              cMath['noise'] = function(array) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._noise(mem, array.length);
                const noise = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return noise;
              };
              cMath['edgeManip'] = function(array, filt, c2Width) {
                mem = _malloc(array.length);
                HEAPU8.set(array, mem);
                Module._edgeManip(mem, array.length, filt, c2Width);
                const edgeManip = HEAPU8.subarray(mem, mem + array.length);
                _free(mem);
                return edgeManip;
              };
              cMath['convFilter'] = function(array, kernel, count, divisor, width, height) {
                const arLen = array.length;
                const memAdr = _malloc(arLen * Float32Array.BYTES_PER_ELEMENT);
                HEAPF32.set(array, memAdr / Float32Array.BYTES_PER_ELEMENT);
                const kerLen = kernel.length;
                const memKrn = _malloc(kerLen * Float32Array.BYTES_PER_ELEMENT);
                HEAPF32.set(kernel, memKrn / Float32Array.BYTES_PER_ELEMENT);
                Module._convFilter(memAdr, width, height, memKrn, 1, divisor, 0.0, count);
                const filtered = HEAPF32.subarray(memAdr / Float32Array.BYTES_PER_ELEMENT, memAdr / Float32Array.BYTES_PER_ELEMENT + arLen);
                _free(memAdr);
                _free(memKrn);
                return filtered;
              }
              resolve(cMath);
            };
            document.body.appendChild(script);
        });
  });
}


// fallback extravaganza
function jsFallback() {
  m['grayScale'] = jsGrayScale;
  m['brighten'] = jsBrighten;
  m['invert'] = jsInvert;
  m['noise'] = jsNoise;
  m['edgeManip'] = jsEdgeManip;
  m['edgeManip'] = jsEdgeManip;
  m['edgeManip'] = jsEdgeManip;
  m['sobelFilter'] = jsConvFilter;
}

function jsGrayScale(data) {
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i+1];
      let b = data[i+2];
      let a = data[i+3];
      let brightness = (r*.21+g*.72+b*.07);

      data[i] = r;
      data[i+1] = r;
      data[i+2] = r;
      data[i+3] = a;
    }
    return data;
}

function jsBrighten(data) {
  let brightness = 25;
  for (let i = 0; i < data.length; i += 4) {
    data[i] + data[i] + brightness > 255 ? 255 : data[i] += brightness;
    data[i+1] + data[i+1] + brightness > 255 ? 255 : data[i+1] += brightness;
    data[i+2] + data[i+2] + brightness > 255 ? 255 : data[i+2] += brightness;
  }
  return data;
}

function jsInvert(data) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i]; //r
    data[i+1] = 255 - data[i+1]; //g
    data[i+2] = 255 - data[i+2]; //b
  }
  return data;
}

function jsNoise(data) {
  let random;
  for (let i = 0; i < data.length; i += 4) {
    random = (Math.random()-0.5)*70
    data[i] = data[i] + random; //r
    data[i+1] = data[i+1] + random; //g
    data[i+2] = data[i+2] + random; //b
  }
  return data;
}

function jsEdgeManip(data, filt, wid) {
  for (let i = 0; i < data.length; i += filt) {
      if (i % 4 != 3) {
        data[i] = 127 + 2 * data[i] - data[i + 4] - data[i + wid * 4];
      }
    }
  return data;
}

function jsConvFilter(data, width, height) {
  const out = [];
  let wid = width;
  let hei = height;
  var grayData = new Int32Array(wid * hei);

        function getPixel(x, y) {
            if (x < 0 || y < 0) return 0;
            if (x >= (wid) || y >= (hei)) return 0;
            return (grayData[((wid * y) + x)]);
        }
        //Grayscale
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {
                var goffset = ((wid * y) + x) << 2; //multiply by 4
                var r = data[goffset];
                var g = data[goffset + 1];
                var b = data[goffset + 2];
                var avg = (r >> 2) + (g >> 1) + (b >> 3);
                grayData[((wid * y) + x)] = avg;
                var doffset = ((wid * y) + x) << 2;
                data[doffset] = avg;
                data[doffset + 1] = avg;
                data[doffset + 2] = avg;
                data[doffset + 3] = 255;
            }
        }
        //Sobel
        for (var y = 0; y < height; y++) {
            for (var x = 0; x < width; x++) {

                var newX;
                var newY;
                if ((x >= width - 1) || (y >= height - 1)) {
                    newX = 0;
                    newY = 0;
                } else {
                    //sobel Filter use surrounding pixels and matrix multiply by sobel       
                    newX = (
                        (-1 * getPixel(x - 1, y - 1)) +
                        (getPixel(x + 1, y - 1)) +
                        (-1 * (getPixel(x - 1, y) << 1)) +
                        (getPixel(x + 1, y) << 1) +
                        (-1 * getPixel(x - 1, y + 1)) +
                        (getPixel(x + 1, y + 1))
                    );
                    newY = (
                        (-1 * getPixel(x - 1, y - 1)) +
                        (-1 * (getPixel(x, y - 1) << 1)) +
                        (-1 * getPixel(x + 1, y - 1)) +
                        (getPixel(x - 1, y + 1)) +
                        (getPixel(x, y + 1) << 1) +
                        (getPixel(x + 1, y + 1))
                    );
                    var mag = Math.floor(Math.sqrt((newX * newX) + (newY * newY)) >>> 0);
                    if (mag > 255) mag = 255;
                    data[((wid * y) + x) * 4] = mag;
                    data[((wid * y) + x) * 4 + 1] = mag;
                    data[((wid * y) + x) * 4 + 2] = mag;
                    data[((wid * y) + x) * 4 + 3] = 255;
                }
            }
        }
    return data; //sobelData;
}


