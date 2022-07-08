/** @type { HTMLInputElement } */
const input = document.querySelector('#audio_input');
/** @type { HTMLInputElement } */
const startButton = document.querySelector("#start_button");


/** @type { HTMLOutputElement } */
const currentProgressOutput = document.querySelector("#current");
/** @type { HTMLOutputElement } */
const totalProgressOutput = document.querySelector("#total");
var currentProgress = 0, totalProgress = 0;
var processing = false;


/** @type { HTMLCanvasElement } */
const canvas = document.querySelector('#canvas');
const ctx = canvas.getContext('2d');
ctx.strokeStyle = 'rgb(255, 0, 0)';
const zoom = 4;


const audioContext = new AudioContext();
/** @type { AudioBufferSourceNode } */
var playSound = undefined;
const framerate = 60;
const waveScale = 2;


/** @type { AudioBuffer } */
var audioBuffer = undefined;
const emptyArrayOnDisplay = new Float32Array(2).fill(0);
/** @type { Float32Array[] } */
var parsedArray = undefined;
var frameNumber = -1;


startButton.addEventListener('click', () => {
    if(!processing && frameNumber == -1 && parsedArray) {
        playSound = audioContext.createBufferSource();
        playSound.buffer = audioBuffer;
        playSound.connect(audioContext.destination);
        playSound.start(0);

        frameNumber = 0;
    }
})


input.addEventListener('input', async () => {
    if(frameNumber != -1) return;

    const buffer = await input.files[0].arrayBuffer();
    if(!buffer) return;

    processing = true;
    audioBuffer = await audioContext.decodeAudioData(buffer);
    parseAudioBuffer();
    processing = false;
})


function parseAudioBuffer() {

    const { numberOfChannels, sampleRate, length } = audioBuffer;
    const sampleRatePerFrame = sampleRate / framerate;
    const frameCount = length / sampleRatePerFrame;

    const channels = new Array(numberOfChannels).fill(0).map((_, i) => audioBuffer.getChannelData(i));
    totalProgress = frameCount;

    const power = Math.pow(2, Math.floor(Math.log(sampleRatePerFrame) / Math.log(2)));
    /** @type { import('fft.js') } */
    const fourierObject = new FFT(power);

    parsedArray = new Array(Math.floor(frameCount))
            .fill(0)
            .map((_, i) => {
                const data = new Array(power);
                var index, j;
                for(j = 0; j < power; ++j) {
                    data[j] = 0;
                    index = i * sampleRatePerFrame + j;
                    for(var channel of channels) {
                        if(index < length) {
                            data[j] += channel[i * sampleRatePerFrame + j];
                        }
                    }
                }
                const out = fourierObject.createComplexArray();
                fourierObject.realTransform(out, data);
                const result = new Array(power / 2);
                for(j = 0; j < power / 2; ++j) {
                    var re = out[2 * j], im = out[2 * j + 1];
                    result[j] = Math.sqrt(re*re + im*im);
                }
                currentProgress = i + 1;
                return result;
            });
}


/**
 * 
 * @param {CanvasRenderingContext2D} context 
 * @param {number} x 
 * @param {number} dx 
 * @param {number} y0 
 * @param {number} y1 
 * @param {number} y2 
 * @param {number} y3 
 */
function drawBezier(context, x, dx, y0, ay, by, y1) {
    const dy0 = (by - y0) / 2;
    const dy1 = (y1 - ay) / 2;
    const ax = x + dx, bx = ax + dx;
    const frac = 1 / 3;
    context.bezierCurveTo(
        ax + frac * dx, ay + frac * dy0,
        bx - frac * dx, by - frac * dy1,
        bx, by
    );
}


var start, nextAt;
const draw = function() {
    if (!start) {
        start = new Date().getTime();
        nextAt = start;
    }
    nextAt += 1000 / framerate;

    // ========================
    var arrayOnDisplay;
    if(frameNumber != -1) {
        arrayOnDisplay = parsedArray[frameNumber];
        frameNumber++;
        if(!parsedArray || !arrayOnDisplay) {
            frameNumber = -1;
            audioContext.currentTime = 0;
            playSound.buffer = null;
        }
    }
    arrayOnDisplay = arrayOnDisplay ?? emptyArrayOnDisplay

    canvas.width = window.innerWidth;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - arrayOnDisplay[0] * waveScale);
    const max = arrayOnDisplay.length / zoom;
    for(var i = 0; i < max; ++i) {
        drawBezier(
            ctx, 
            i * canvas.width / (max - 1), canvas.width / (max - 1),
            canvas.height - (arrayOnDisplay[i-1] ?? arrayOnDisplay[i  ]) * waveScale,
            canvas.height -  arrayOnDisplay[i  ]                         * waveScale,
            canvas.height -  arrayOnDisplay[i+1]                         * waveScale,
            canvas.height - (arrayOnDisplay[i+2] ?? arrayOnDisplay[i+1]) * waveScale,
        );
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fill();
    // ========================

    setTimeout(draw, nextAt - new Date().getTime());
}

draw();


// update progress
setInterval(() => {
    currentProgressOutput.value = currentProgress;
    totalProgressOutput.value = totalProgress;
}, 30)