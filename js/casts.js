'use strict';

module.exports = {
  init,
  toggleMenu,
  selectDevice,
  stop,
  play,
  pause,
  seek,
  setVolume,
  setRate
}

// Lazy load these for a ~300ms improvement in startup time
let airplayer, chromecasts, dlnacasts
// App state. Cast modifies state.playing and state.errors in response to events
let state
// Callback to notify module users when state has changed
let update, updateState
// setInterval() for updating cast status
let statusInterval = null
// Start looking for cast devices on the local network
function init (appState, listUpdateCb,updateStateCb) {
  try {
    state = appState
    update = listUpdateCb
    updateState = updateStateCb

    // Load modules, scan the network for devices
    airplayer = require('airplayer')()
    chromecasts = require('chromecasts')()
    dlnacasts = require('dlnacasts')()
    state.devices.chromecast = chromecastPlayer()
    state.devices.dlna = dlnaPlayer()
    state.devices.airplay = airplayPlayer()
    // Listen for devices: Chromecast, DLNA and Airplay
    chromecasts.on('update', function (device) {
      state.devices.chromecast.addDevice(device)
    })
    dlnacasts.on('update', function (device) {
      state.devices.dlna.addDevice(device)
    })
    airplayer.on('update', function (device) {
      state.devices.airplay.addDevice(device)
    })
  } catch(err) {
    console.log('CAST ERROR', err)
  }
}

// chromecast player implementation
function chromecastPlayer () {
  var ret = {
    device: null,
    addDevice,
    getDevices,
    open,
    play,
    pause,
    stop,
    status,
    seek,
    volume
  }
  return ret
  function getDevices () {
    return chromecasts.players
  }
  function addDevice (device) {
    device.on('error', function (err) {
      if (device !== ret.device) return
      state.playing.location = 'local'
      state.errors.push({
        time: new Date().getTime(),
        message: 'Could not connect to Chromecast. ' + err.message
      })
      console.log('Update dlna list')

    })
    device.on('disconnect', function () {
      if (device !== ret.device) return
      state.playing.location = 'local'

    })
  }
  function open () {
    ret.device.play(state.media.link, {
      title: state.media.title,
      seek: state.playing.currentTime > 10 ? state.playing.currentTime : 0
    }, function (err) {
      if (err) {
        state.playing.location = 'local'
        state.errors.push({
          time: new Date().getTime(),
          message: 'Could not connect to Chromecast. ' + err.message
        })
      } else {
        state.playing.location = 'chromecast'
        console.log('IN OPEN CHROMECAST CAST.js')
      }

    })
  }
  function play (callback) {
    console.log('IN PLAY CHROMECAST CAST.js')
    updateState(state)
    ret.device.play(null, null, callback)
  }
  function pause (callback) {
    ret.device.pause(callback)
  }
  function stop (callback) {
    ret.device.stop(callback)
  }
  function status () {
    ret.device.status(handleStatus)
  }
  function seek (time, callback) {
    ret.device.seek(time, callback)
  }
  function volume (volume, callback) {
    ret.device.volume(volume, callback)
  }
}

// airplay player implementation
function airplayPlayer () {
  var ret = {
    device: null,
    addDevice,
    getDevices,
    open,
    play,
    pause,
    stop,
    playerStatus,
    seek,
    volume
  }
  return ret
  function addDevice (player) {
    // player.on('event', function (event) {
    //   console.log("AIRPLAT EVENT ",event)
    //   switch (event.state) {
    //     case 'loading':
    //     break
    //     case 'playing':
    //     state.playing.isPaused = false
    //     break
    //     case 'paused':
    //     state.playing.isPaused = true
    //     break
    //     case 'stopped':
    //     break
    //   }
    // })
    console.log('Update airplay list')
    update(state)
  }
  function getDevices () {
    return airplayer.players
  }
  function open () {
    ret.device.play(state.media.link, function (err, res) {
      if (err) {
        state.playing.location = 'local'
        state.errors.push({
          time: new Date().getTime(),
          message: 'Could not connect to AirPlay. ' + err.message
        })
      } else {
        state.playing.location = 'airplay'
      }
    })
  }
  function play (callback) {
    updateState(state)
    ret.device.resume(callback)
  }
  function pause (callback) {
    ret.device.pause(callback)
  }
  function stop (callback) {
    ret.device.stop(callback)
  }
  function playerStatus () {
    ret.device.playbackInfo(function (err, res, status) {
      if (err) {
        state.playing.location = 'local'
        state.errors.push({
          time: new Date().getTime(),
          message: 'Could not connect to AirPlay. ' + err.message
        })
      } else {
        state.playing.isPaused = status.rate === 0
        state.playing.currentTime = status.position
        state.playing.duration = status.duration
      }
    })
  }
  function seek (time, callback) {
    ret.device.scrub(time, callback)
  }
  function volume (volume, callback) {
    // AirPlay doesn't support volume
    // TODO: We should just disable the volume slider
    state.playing.volume = volume
  }
}

// DLNA player implementation
function dlnaPlayer (player) {
  var ret = {
    device: null,
    addDevice,
    getDevices,
    open,
    play,
    pause,
    stop,
    status,
    seek,
    volume
  }
  return ret
  function getDevices () {
    return dlnacasts.players
  }
  function addDevice (device) {
    device.on('error', function (err) {
      if (device !== ret.device) return
      state.playing.location = 'local'
      state.errors.push({
        time: new Date().getTime(),
        message: 'Could not connect to DLNA. ' + err.message
      })
      console.log('Update dlna list')
        update(state)
    })
    console.log('Update dlna list')
    update(state)
    device.on('disconnect', function () {
      if (device !== ret.device) return
      state.playing.location = 'local'
        update(state)
    })
  }
  function open () {
    const torrentSummary = state.saved.torrents.find(function(x) { x.infoHash === state.playing.infoHash})
    ret.device.play(state.media.link, {
      type: 'video/mp4',
      title: state.media.title,
      seek: state.playing.currentTime > 10 ? state.playing.currentTime : 0
    }, function (err) {
      if (err) {
        state.playing.location = 'local'
        state.errors.push({
          time: new Date().getTime(),
          message: 'Could not connect to DLNA. ' + err.message
        })
      } else {
        state.playing.location = 'dlna'
      }
    })
  }
  function play (callback) {
    updateState(state)
    ret.device.play(null, null, callback)
  }
  function pause (callback) {
    ret.device.pause(callback)
  }
  function stop (callback) {
    ret.device.stop(callback)
  }
  function status () {
    console.log('in status dlna')
    ret.device.status(handleStatus)
  }
  function seek (time, callback) {
    ret.device.seek(time, callback)
  }
  function volume (volume, callback) {
    ret.device.volume(volume, function (err) {
      // quick volume update
      state.playing.volume = volume
      callback(err)
    })
  }
}

function handleStatus (err, status) {
  if (err || !status) {
    return console.log('error getting %s status: %o',
    state.playing.location,
    err || 'missing response')
  }
  state.playing.isPaused = status.playerState === 'PAUSED'
  state.playing.currentTime = status.currentTime || 0
  state.playing.duration = status.duration || 0
  state.playing.volume = status.volume.muted ? 0 : status.volume.level
  updateState(state)
}

/*
* Shows the device menu for a given cast type ('chromecast', 'airplay', etc)
* The menu lists eg. all Chromecasts detected; the user can click one to cast.
* If the menu was already showing for that type, hides the menu.
*/
function toggleMenu (location) {
  // If the menu is already showing, hide it
  if (state.devices.castMenu && state.devices.castMenu.location === location) {
    state.devices.castMenu = null
    return
  }
  // Never cast to two devices at the same time
  if (state.playing.location !== 'local') {
    console.log("You can't connect to "+location+" when already connected to another device")
    // Find all cast devices of the given type
    const player = getPlayer(location)
    const devices = player ? player.getDevices() : []
    if (devices.length === 0) {
      console.log("No "+location+" devices available")
    }
    // Show a menu
    state.devices.castMenu = {location, devices}
  }
}

function selectDevice (index) {
  var location, devices = state.devices.castMenu
  // Start casting
  var player = getPlayer(location)
  player.device = devices[index]
  player.open()
  // Poll the casting device's status every few seconds
  //startStatusInterval()
  // Show the Connecting... screen
  state.devices.castMenu = null
  state.playing.castName = devices[index].name
  state.playing.location = location + '-pending'
  update(state)
}

// Stops casting, move video back to local screen
function stop () {
  const player = getPlayer()
  if (player) {
    player.stop(function () {
      player.device = null
      stoppedCasting()
    })
    clearInterval(statusInterval)
  } else {
    stoppedCasting()
  }
}

function stoppedCasting () {
  state.playing.location = 'local'
  state.playing.jumpToTime = Number.isFinite(state.playing.currentTime)
  ? state.playing.currentTime
  : 0
  updateState(state)
}

function getPlayer (location) {
  if (location) {
    return state.devices[location]
  } else if (state.playing.location === 'chromecast') {
    return state.devices.chromecast
  } else if (state.playing.location === 'airplay') {
    return state.devices.airplay
  } else if (state.playing.location === 'dlna') {
    return state.devices.dlna
  } else {
    return null
  }
}

function play () {
  const player = getPlayer()
  if (player) player.play(castCallback)
}

function pause () {
  const player = getPlayer()
  if (player) player.pause(castCallback)
}

function setRate (rate) {
  let player
  let result = true
  if (state.playing.location === 'chromecast') {
    // TODO find how to control playback rate on chromecast
    castCallback()
    result = false
  } else if (state.playing.location === 'airplay') {
    player = state.devices.airplay
    player.rate(rate, castCallback)
  } else {
    result = false
  }
  return result
}

function seek (time) {
  const player = getPlayer()
  if (player) player.seek(time, castCallback)
}

function setVolume (volume) {
  const player = getPlayer()
  if (player) player.volume(volume, castCallback)
}

function castCallback () {
  console.log('%s callback: %o', state.playing.location, arguments)
}