const recorder = require('../helpers/recorder');

const recorderExport = {

  setRecordMode(sessionName) {
    recorder.setMode('RECORD', sessionName);
  },

  setPlaybackMode(sessionName) {
    recorder.setMode('PLAYBACK', sessionName);
  },

  setAutoMode(sessionName) {
    recorder.setMode('AUTO', sessionName);
  },

  stopRecording() {
    recorder.stop();
  },

  clearRecordings(sessionName) {
    recorder.clear(sessionName);
  }

};

module.exports = recorderExport;
