var audioMetaData = require('audio-metadata');

function BufferLoader(context, urlList, callback) {
    this.phoneme = new String;
    this.context = context;
    this.urlList = urlList;
    this.onload = callback;
    this.bufferList = new Array();
    this.loadCount = 0;
}

BufferLoader.prototype.loadBuffer = function (url, index) {

    // Load buffer asynchronously
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    var loader = this;
    request.onload = function () {

        
        var metadata = audioMetaData.id3v1(request.response);
        loader.phoneme = metadata.phoneme ? metadata.phoneme.match(/mment="(.+)"/ig) ? metadata.phoneme.match(/mment="(.+)"/ig)[0].split("mment=")[1] : metadata.phoneme : "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent ac risus vel dolor gravida laoreet in eu tortor. Sed pharetra facilisis porttitor. Nulla nisi libero, condimentum quis interdum dictum, convallis sit amet nulla. Phasellus mattis venenatis metus sit amet placerat. Nam ac sollicitudin nulla. Morbi non imperdiet eros. Nam at dui ante. Sed luctus sed quam ut pretium.";
        loader.context.decodeAudioData(

            request.response,

            function (buffer) {

                if (!buffer) {
                    alert('error decoding file data: ' + url);
                    return;
                }
                
                loader.bufferList[index] = buffer;
                if (++loader.loadCount == loader.urlList.length)
                    loader.onload(loader.bufferList);
            },

            function (error) {
                console.error('decodeAudioData error', error);
            }
        );
    };

    request.onerror = () => {
        alert('BufferLoader: XHR error');
    };
    request.send();
}

BufferLoader.prototype.load = function () {

    for (var i = 0; i < this.urlList.length; ++i)
        this.loadBuffer(this.urlList[i], i);
}

export default BufferLoader;