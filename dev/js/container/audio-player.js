import React, {Component} from 'react';
import {bindActionCreators} from 'redux';
import {connect} from 'react-redux';
import {selectPhoneme} from '../actions/index';
import AsciiClip from '../container/ascii-clip';
import Slider from 'react-rangeslider';
import BufferLoader from '../buffer/buffer-loader';

import styles from '../../scss/style.scss';

var audioMetaData = require('../buffer/audio-metadata');

class AudioPlayer extends Component {
    constructor(props, context) {
        super(props, context)
        this.state = {
            audioContext: undefined,
            audioSources:[],
            pitchShifterProcessor: undefined,
            spectrumAudioAnalyser: undefined,
            canvas: undefined,
            canvasContext: undefined,
            barGradient: undefined,
            waveGradient: undefined,
            sourceDuration: 0,
            
            audioSourceIndex: 0,
            grainSize: validGranSizes[2],
            pitchRatio: 0.99,
            overlapRatio: 0.50,

            duration: 0,
            requestAnimFrame: undefined,
            resetTime: false,
            offset: 0,
            overflow: 0
        }
        this.initProcessor = this.initProcessor.bind(this);
        this.initCanvas = this.initCanvas.bind(this);
        this.renderCanvas = this.renderCanvas.bind(this);
        this.init = this.init.bind(this);
    }
    hannWindow(length) {

        var window = new Float32Array(length);
        for (var i = 0; i < length; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
        }
        return window;
    };

    linearInterpolation(a, b, t) {
        return a + (b - a) * t;
    };

    initAudio() {
        var that = this;
        if (!navigator.mediaDevices.getUserMedia) {

            console.log('Your browser does not support the Media Stream API');

        } else {

            navigator.mediaDevices.getUserMedia(

                {audio: true, video: false},

                function (stream) {
                    var audioSources = that.state.audioSources
                    audioSources[1] = that.state.audioContext.createMediaStreamSource(stream);
                    //var audio;
                    //audio.srcObject = stream;
                    that.state.audioContext.onloadedmetadata = function(e) {
                        console.log('LOADED AUDIO META DATA:')
                    };
                    that.setState({ audioSources: audioSources});
                },

                function (error) {
                    console.log('Unable to get the user media');
                }
            )
        }

        var spectrumAudioAnalyser = this.state.audioContext.createAnalyser();

        spectrumAudioAnalyser.fftSize = spectrumFFTSize;
        spectrumAudioAnalyser.smoothingTimeConstant = spectrumSmoothing;


        this.setState({
            spectrumAudioAnalyser: spectrumAudioAnalyser,
        })

        var bufferLoader = new BufferLoader(
            this.state.audioContext, ['audio/alexruss.mp3'], function (bufferList) {
                that.setPhoneme(this.phoneme.split('â').join("'"));//;
                var audioSources = that.state.audioSources;
                audioSources[0] = that.state.audioContext.createBufferSource();
                audioSources[0].buffer = bufferList[0];
                audioSources[0].loop = false;
                audioSources[0].connect(that.state.pitchShifterProcessor);


                //console.log('META DATA: ', audioMetaData.ogg())
                console.log('AUDIO SOURCE: ', audioSources[0])
                console.log('AUDIO CONTEXT: ', that.state.audioContext);

                var duration = parseInt(audioSources[0].buffer.duration);
                var frameMax = that.props.phonemeFrames.length - 1;
                var frame = (duration/frameMax) * that.state.duration;
                
                audioSources[0].start(0,that.state.offset);
                
                that.setState({ audioSources: audioSources, sourceDuration: duration}); //, offset: 0
                //window.requestAnimFrame(that.renderCanvas);
            }
        );

        bufferLoader.load()
        
        /*.then(function(stream) {
            
        });*/

        //
        //
    };

    initProcessor() {
        var that = this;
        var pitchShifterProcessor = this.state.pitchShifterProcessor;
        if (this.state.pitchShifterProcessor) {
            this.state.pitchShifterProcessor.disconnect();
        }

        if (this.state.audioContext.createScriptProcessor) {
            pitchShifterProcessor = this.state.audioContext.createScriptProcessor(this.state.grainSize, 1, 1);
        } else if (this.state.audioContext.createJavaScriptNode) {
            pitchShifterProcessor = this.state.audioContext.createJavaScriptNode(this.state.grainSize, 1, 1);
        }
        pitchShifterProcessor.buffer = new Float32Array(this.state.grainSize * 2);
        pitchShifterProcessor.grainWindow = this.hannWindow(this.state.grainSize);
        pitchShifterProcessor.onaudioprocess = (event) => {
            var inputData = event.inputBuffer.getChannelData(0);
            var outputData = event.outputBuffer.getChannelData(0);

            for (var i = 0; i < inputData.length; i++) {

                //console.log('THIS GRAIN WINDOW: ', pitchShifterProcessor.grainWindow[i]);
                // Apply the window to the input buffer
                inputData[i] *= pitchShifterProcessor.grainWindow[i];

                // Shift half of the buffer
                pitchShifterProcessor.buffer[i] = pitchShifterProcessor.buffer[i + that.state.grainSize];

                // Empty the buffer tail
                pitchShifterProcessor.buffer[i + that.state.grainSize] = 0.0;
            }

            // Calculate the pitch shifted grain re-sampling and looping the input
            var grainData = new Float32Array(that.state.grainSize * 2);
            for (var i = 0, j = 0.0;
                    i < that.state.grainSize;
                    i++, j += that.state.pitchRatio) {

                var index = Math.floor(j) % that.state.grainSize;
                var a = inputData[index];
                var b = inputData[(index + 1) % that.state.grainSize];
                grainData[i] += that.linearInterpolation(a, b, j % 1.0) * pitchShifterProcessor.grainWindow[i];
            }

            // Copy the grain multiple times overlapping it
            for (var i = 0; i < that.state.grainSize; i += Math.round(that.state.grainSize * (1 - that.state.overlapRatio))) {
                for (j = 0; j <= that.state.grainSize; j++) {
                    pitchShifterProcessor.buffer[i + j] += grainData[j];
                }
            }

            // Output the first half of the buffer
            for (var i = 0; i < that.state.grainSize; i++) {
                outputData[i] = pitchShifterProcessor.buffer[i];
            }
        }
        pitchShifterProcessor.connect(this.state.spectrumAudioAnalyser);
        pitchShifterProcessor.connect(this.state.audioContext.destination);
        this.setState({ pitchShifterProcessor: pitchShifterProcessor });

        
    };
    initCanvas() {
        var canvas = this.refs.canvas;
        var canvasContext = canvas.getContext('2d');

        var barGradient = canvasContext.createLinearGradient(0, 0, 1, canvas.height - 1);
        barGradient.addColorStop(0, styles.bodyOrange);
        barGradient.addColorStop(0.995, styles.secondaryOrange);
        barGradient.addColorStop(1, styles.bodyOrange);

        var waveGradient = canvasContext.createLinearGradient(canvas.width - 2, 0, canvas.width - 1, canvas.height - 1);
        waveGradient.addColorStop(0, '#FFFFFF');
        waveGradient.addColorStop(0.75, styles.bodyOrange);
        waveGradient.addColorStop(0.75, '#555555');
        waveGradient.addColorStop(0.76, styles.secondaryOrange);
        waveGradient.addColorStop(1, '#FFFFFF');

        this.setState({
            canvas: canvas,
            canvasContext: canvasContext,
            barGradient: barGradient,
            waveGradient: waveGradient
        })
    };
    setPhoneme(stringToSplit, separator = null) {
        var arrayOfSpaces = stringToSplit.split(' ');

        
        var jCount = arrayOfSpaces.length;
        var pos = 0;
        for (var i = 0; i < stringToSplit.length; i++){
            var charString = stringToSplit.substring(i,i+1);
            var phonemeFrame = this.matchPhoneme(charString, pos)
            
            if(phonemeFrame[1] == pos){
                phonemeArr[phonemeArr.length - 1] = phonemeFrame;
                phonemeFrames[phonemeFrames.length - 1] = phonemeFrame[0].payload
            }else{
                phonemeArr.push(phonemeFrame)
                phonemeFrames.push(phonemeFrame[0].payload)
            }

            //console.log(!phonemeFrames[phonemeFrames.length - 1] && ('MISSING: ', phonemeArr[phonemeArr.length - 1]))
            pos++
        }
        
        console.log('The original string is: "' + stringToSplit + '"');
        console.log('PHONEME ARRAY: ', phonemeFrames);
        
        this.state.audioContext.resume()
        window.requestAnimFrame(this.renderCanvas);
        //window.addEventListener("DOMContentLoaded", this.init, true);
    }
    matchPhoneme(string, pos){
        var phonome
        var updatePos = pos;
        var key
        
        switch(string){
            case (string.match(/th/i) || {}).input:
            case (string.match(/l/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['ldth']);
                key = 'ldth';
                updatePos++
                break;
            case (string.match(/c/i) || {}).input:
            case (string.match(/d/i) || {}).input:
            case (string.match(/g/i) || {}).input:
            case (string.match(/k/i) || {}).input:
            case (string.match(/n/i) || {}).input:
            case (string.match(/r/i) || {}).input:
            case (string.match(/t/i) || {}).input:
            case (string.match(/y/i) || {}).input:
            case (string.match(/z/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['cd']);
                key = 'cd';
                updatePos++
                break;
            case (string.match(/f/i) || {}).input:
            case (string.match(/v/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['fv']);
                key = 'fv';
                updatePos++
                break;
            case (string.match(/m/i) || {}).input:
            case (string.match(/b/i) || {}).input:
            case (string.match(/p/i) || {}).input: 
                phonome = this.props.selectPhoneme(this.props.phoneme['mbp']);//
                key = 'mbp';
                updatePos++
                break;
            case (string.match(/a/i) || {}).input:
            case (string.match(/i/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['ai']);//
                key = 'ai';
                updatePos++
                break;
            case (string.match(/h/i) || {}).input: 
                // Check for T and C before before H
                if(phonemeArr[phonemeArr.length - 1] && (phonemeArr[phonemeArr.length - 1][2].match(/t/i) || {}).input){
                    // T found before H
                    string =  phonemeArr[phonemeArr.length - 1][2] + string;
                    phonome = this.props.selectPhoneme(this.props.phoneme['ldth']);
                    key = 'ldth';
                }else if(phonemeArr[phonemeArr.length - 1] && (phonemeArr[phonemeArr.length - 1][2].match(/c/i) || {}).input){
                    // C found before H
                    string =  phonemeArr[phonemeArr.length - 1][2] + string;
                    phonome = this.props.selectPhoneme(this.props.phoneme['u']);
                    key = 'u';
                }else{
                    phonome = this.props.selectPhoneme(this.props.phoneme['ai']);
                    key = 'ai';
                    updatePos++
                }
                break;
            case (string.match(/o/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['o']);
                key = 'o';
                updatePos++
                break;
            case (string.match(/e/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['e']);
                key = 'e';
                updatePos++
                break;
            case (string.match(/u/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['u']);
                key = 'u';
                updatePos++
                break;
            case (string.match(/w/i) || {}).input:
            case (string.match(/q/i) || {}).input:
                phonome = this.props.selectPhoneme(this.props.phoneme['wq']);
                key = 'wq';
                updatePos++
                break;
            case (string.match(/ /i) || {}).input:
            case (string.match(/./i) || {}).input:
            case (string.match(/,/i) || {}).input:
            default:
                var silent = ['smile','silent']
                var silentIndex = Math.floor(Math.random() * 2) + 1;
                key = silent[silentIndex - 1];
                phonome = this.props.selectPhoneme(this.props.phoneme[key]);//(silent[silentIndex]);
                updatePos++
                break;
        }
        
        return [phonome, updatePos, string, key]
    }
    
    renderCanvas() {
        var canvas = this.refs.canvas;
        

        var frequencyData = new Uint8Array(this.state.spectrumAudioAnalyser.frequencyBinCount);
        this.state.spectrumAudioAnalyser.getByteFrequencyData(frequencyData);

        this.state.canvasContext.clearRect(0, 0, canvas.width, canvas.height);
        this.state.canvasContext.fillStyle = this.state.barGradient;

        var barWidth = canvas.width / frequencyData.length;
        
        for (var i = 0; i < frequencyData.length; i++) {
            var magnitude = frequencyData[i];
            this.state.canvasContext.fillRect(barWidth * i, canvas.height, barWidth - 1, -magnitude - 1);
        }
        var audioDuration;       
        if(this.state.audioSources[0]){
            

            
            if(this.state.overflow != 0){
                audioDuration =  parseInt(((this.state.audioSources[0].context.currentTime + this.state.offset)/this.state.audioSources[0].buffer.duration) * (this.props.phonemeFrames.length - 1)) - (this.state.offset + this.state.overflow);
            }else{
                audioDuration = parseInt(((this.state.audioSources[0].context.currentTime + this.state.offset)/this.state.audioSources[0].buffer.duration) * (this.props.phonemeFrames.length - 1));
            }
            var phonemeTimeData = new Uint8Array(this.state.spectrumAudioAnalyser.frequencyBinCount);
            this.state.spectrumAudioAnalyser.getByteTimeDomainData(phonemeTimeData);
            var phonemeAmplitude = 0.0;

            for (i = 0; i < phonemeTimeData.length; i++) {
                phonemeAmplitude += phonemeTimeData[i];
            }
            phonemeAmplitude = Math.abs(phonemeAmplitude / phonemeTimeData.length - 128) * 5 + 1;

            // Check for math overflow offset   
            // console.log(audioDuration > phonemeArr.length ? ((audioDuration - phonemeArr.length + this.state.offset) - phonemeArr.length) + audioDuration + this.state.offset : this.state.offset );
            if(phonemeAmplitude > 2.0){
                this.props.selectPhoneme(this.props.phoneme[phonemeArr[audioDuration][3]])
            }else{
                var silent = ['smile','silent']
                var silentIndex = Math.floor(Math.random() * 2) + 1;
                var key = silent[silentIndex - 1];
                this.props.selectPhoneme(this.props.phoneme['smile']);
            }
        }
        if(this.state.audioSources[0] && (this.state.audioSources[0].buffer.duration > (this.state.audioSources[0].context.currentTime + this.state.offset)) ||
        this.state.overflow != 0 && audioDuration < (this.props.phonemeFrames.length - 1)
        ){
            var myReq = window.requestAnimFrame(this.renderCanvas);
            this.setState({
                requestAnimFrame: myReq
            })
        }else if(!this.state.audioSources[0]){
            var myReq = window.requestAnimFrame(this.renderCanvas);
            this.setState({
                requestAnimFrame: myReq
            })
        }
    };
    init(){
        var that = this;
        if ('AudioContext' in window) {
            that.setState({
                audioContext: new AudioContext()
            });
        } else if ('webkitAudioContext' in window ){
            that.setState({
                audioContext: new webkitAudioContext()
            })
        } else {
            console.log('Your browser does not support the Web Audio API');
            return;
        }

        that.state.audioContext.onstatechange = function() {
            console.log('--------------------------------------------');
            console.log('AUDIO STATE: ', that.state.audioContext.state);
            if(phonemeFrames < 1)
            that.state.audioContext.suspend()
            console.log('--------------------------------------------');
        }

        that.initAudio();
        that.initProcessor();
        that.initCanvas();

        /*
        var myReq = window.requestAnimFrame(that.renderCanvas);
        that.setState({
            requestAnimFrame: myReq
        })*/
    }
    componentDidMount(){
        window.addEventListener("DOMContentLoaded", this.init, true);
    }
    render(){
        var that = this;
        var pitchRatioDisplay = this.state.pitchRatio;

        var audioDuration;
        if(this.state.overflow != 0 && this.state.audioSources[0] && !this.state.resetTime ){//(this.props.phonemeFrames.length - 1)
            audioDuration =  parseInt(((this.state.audioSources[0].context.currentTime + this.state.offset)/this.state.audioSources[0].buffer.duration) * (this.props.phonemeFrames.length - 1)) - (this.state.offset + this.state.overflow);
        }else{
            audioDuration = this.state.audioSources[0] && !this.state.resetTime ? parseInt(((this.state.audioSources[0].context.currentTime + this.state.offset)/this.state.audioSources[0].buffer.duration) * (this.props.phonemeFrames.length - 1)) :
            this.state.duration;
        };

        if(this.state.overflow > 0){
            console.log('DURATION WITH OVERFLOW: ', audioDuration, ', OVERFLOW: ', this.state.overflow);
        }
        return (
            <div className="container" ref="audioContainer">
                <div className="header">
                    <h2>Experiment 223:</h2> 
                </div>
                <AsciiClip />
                <div className="footer">
                    <canvas ref="canvas" style={{width: '100%', height: '50px'}}></canvas>
                    <div className="sliderContainer">
                        <Slider
                            ref="duration"
                            value={audioDuration}
                            step={1}
                            min={0}
                            max={this.props.phonemeFrames.length - 1}
                            orientation="horizontal"
                            onChangeStart={(value) => {
                                console.log('CHANGE START: ', this.state.audioSources[0].context.currentTime);

                                var duration = parseInt(this.state.sourceDuration);
                                var frameMax = this.props.phonemeFrames.length - 1;
                                var frame = (duration/frameMax) * this.state.duration;

                                this.state.audioSources[0].stop();
                                this.state.audioContext.suspend()
                                this.setState({resetTime:true});
                            }}
                            onChange={(value) => {
                                this.setState({ duration: value }); 
                                this.props.selectPhoneme(this.props.phoneme[phonemeArr[value][3]]);
                                audioDuration = value;
                            }}

                            onChangeComplete={(value) => {
                                var audioContext
                                if ('AudioContext' in window) {
                                    audioContext = new AudioContext();
                                } else if ('webkitAudioContext' in window ){
                                    audioContext = new webkitAudioContext();
                                } else {
                                    alert('Your browser does not support the Web Audio API');
                                    return;
                                };
                                navigator.mediaDevices.getUserMedia(
                                    
                                    {audio: true, video: false},
                    
                                    function (stream) {
                                        var audioSources = that.state.audioSources
                                        audioSources[1] = audioContext.createMediaStreamSource(stream);
                                        that.setState({ audioSources: audioSources});
                                    },
                    
                                    function (error) {
                                        console.log('Unable to get the user media');
                                    }
                                );

                                var spectrumAudioAnalyser = audioContext.createAnalyser();
                                
                                spectrumAudioAnalyser.fftSize = spectrumFFTSize;
                                spectrumAudioAnalyser.smoothingTimeConstant = spectrumSmoothing;

                                this.setState({
                                    audioContext:audioContext,
                                    resetTime:false,
                                    spectrumAudioAnalyser: spectrumAudioAnalyser
                                });
                                

                                var bufferLoader = new BufferLoader(
                                    audioContext, ['audio/alexruss.mp3'], function (bufferList) {
                                        var audioSources = that.state.audioSources;
                                        audioSources[0] = that.state.audioContext.createBufferSource();
                                        audioSources[0].buffer = bufferList[0];
                                        audioSources[0].loop = false;

                                        console.log('BUFFER LIST: ', bufferList);
//audioMetaData.ogg(oggData)
                                        that.initProcessor();

                                        audioSources[0].connect(that.state.pitchShifterProcessor)

                                        var duration = parseInt(that.state.audioSources[0].buffer.duration);
                                        var frameMax = that.props.phonemeFrames.length - 1;
                                        var frame = parseInt((duration/frameMax) * that.state.duration);
                                        
                                        console.log('BUFFER DURATION: ', duration, ' / FRAME COUNT : ', frameMax, ' = ', duration / frameMax, ' *  STATE DURATION: ', that.state.duration, ' = ', frame );

                                        console.log('CHANGE COMPLETE, SOURCE DURATION: ', that.state.sourceDuration, ' , STARTING FRAME: ', frame, ', CURRENT TIME: ', audioSources[0].context.currentTime);
                                        console.log(that.state.sourceDuration, audioSources[0].context.currentTime, frame);//
                                        console.log(0, frame, that.state.sourceDuration - frame);
                                        
                                        that.setState({ audioSources: audioSources, sourceDuration: duration, resetTime: false, offset:frame});//this.state.offset
                                        that.state.audioSources[0].start(0, frame);
                                        console.log('CHANGE COMPLETE, SOURCE DURATION: ', that.state.sourceDuration, ' , STARTING FRAME: ', frame, ', CURRENT TIME: ', audioSources[0].context.currentTime);
                                        
                                        that.state.audioContext.resume().then((state) => {
                                            var state = that.state.audioContext.state;
                                            console.log('--------------------------------------------');
                                            console.log('AUDIO STATE: ', state);
                                            console.log('--------------------------------------------');
                                            if(state == "running"){
                                                var overDuration = parseInt(((that.state.audioSources[0].context.currentTime + that.state.offset)/that.state.audioSources[0].buffer.duration) * (that.props.phonemeFrames.length - 1));//parseInt(((that.state.audioSources[0].context.currentTime)/that.state.audioSources[0].buffer.duration) * (that.props.phonemeFrames.length - 1))
                                                var DecreasedDuration = overDuration - phonemeArr.length;// audioDuration > phonemeArr.length ? (audioDuration - phonemeArr.length) : 0
                                                var overflow =  overDuration > (phonemeArr.length - 1) ? overDuration - ((overDuration - (phonemeArr.length - 1)) + audioDuration) : 0;
                                                console.log('OVER DURATION:  ', overDuration)
                                                console.log('AUDIO DURATION: ', audioDuration);
                                                console.log('OVERFLOW: ', overflow);
        
                                                that.setState({overflow: overflow});
                                                window.requestAnimFrame(that.renderCanvas);
                                                that.renderCanvas();
                                            }
                                        });
                                    }
                                )
                        
                                bufferLoader.load();
                            }}
                        />
                    </div>
                    <div className="column">
                        <div className="sliderContainer row">
                            <p className="sliderLabel">pitch ratio</p>
                            <Slider
                                ref="pitchRatioSlider"
                                value={pitchRatioDisplay}
                                min = {0.5}
                                max = {2}
                                step = {0.01}
                                orientation="vertical"
                                onChange = {(value) => {
                                    this.setState({ pitchRatio: value });
                                }}
                            />
                        </div>
                
                        <div className="sliderContainer row">
                            <div className="sliderLabel">overlap ratio</div>
                            <Slider
                                ref="overlapRatioSlider"
                                value={this.state.overlapRatio}
                                min = {0}
                                max = {0.75}
                                step = {0.01}
                                orientation="vertical"
                                onChange = {(value) => {
                                    this.setState({ overlapRatio: value });
                                }}
                            />
                        </div>
                
                        <div className="sliderContainer row">
                            <div className="sliderLabel">grain size</div>
                            <Slider
                                ref="grainSizeSlider"
                                value={validGranSizes.indexOf(this.state.grainSize)}
                                min = {0}
                                max = {validGranSizes.length - 1}
                                step = {1}
                                orientation="vertical"
                                onChange = {(value) => {
                                    this.setState({grainSize: validGranSizes[value]});
                                    this.initProcessor();
                                    /*
                                    */
                                    if (this.state.audioSources[this.state.audioSourceIndex]) {
                                        this.state.audioSources[this.state.audioSourceIndex].connect(this.state.pitchShifterProcessor);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

window.requestAnimFrame = (() => {
    return (window.requestAnimationFrame || window.mozRequestAnimationFrame || 
        window.webkitRequestAnimationFrame || window.msRequestAnimationFrame)
})();

window.cancelAnimFrame = (() => {
    return (window.cancelAnimationFrame || window.mozCancelAnimationFrame);
})

const audioVisualisationNames = ['Spectrum'];
const validGranSizes = [256, 512, 1024, 2048, 4096, 8192];
const sonogramFFTSize = 2048;
const spectrumFFTSize = 128;
const spectrumSmoothing = 0.8;

var phonemeArr = [];
var phonemeFrames = [];

function mapStatesToProps(state) {
    return {
        phoneme: state.phoneme,
        phonemeFrames: phonemeFrames
    }
}
function matchDispatchToProps(dispatch){
    return bindActionCreators(
        {
            selectPhoneme: selectPhoneme
        }, dispatch)
}

export default connect(mapStatesToProps,matchDispatchToProps)(AudioPlayer);