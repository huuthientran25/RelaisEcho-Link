// Every threshold here is MODELED: a design choice for the prototype, not a clinical cut off.
// Tune them from the bench test, and record any change in the README.

export const CONFIG = {
  // Set to true after adding samples/sample.mp4 (a recording of a consenting adult team member).
  // The home page then shows a "Watch sample replay" button.
  sampleReplay: false,
  scan: {
    targetUsableSeconds: 30,   // timer counts only frames that pass every gate
    maxElapsedSeconds: 120,    // give up and report what is usable after this
  },
  quality: {
    minFaceWidthFrac: 0.16,    // face width as a fraction of frame width (too far away below this)
    minLuma: 60,               // mean face brightness, 0 to 255
    maxLuma: 235,
    maxClippedFrac: 0.05,      // share of face pixels with a channel at 250 or more
    maxMotionPerSec: 0.12,     // landmark speed, in face widths per second
    minFps: 8,                 // analysed frames per second; below this frames are rejected (a 3 Hz pulse needs more than 6)
    softFps: 12,               // between minFps and this, frames count but a 'low frame rate' warning shows
    motionHoldSlack: 1.3,      // same idea for the stillness check
  },
  perf: {
    // Face tracking runs on the same thread as the page. If it takes longer than this per frame,
    // only every second camera frame is analysed so buttons, scrolling and the progress bar stay smooth.
    // 15 analysed frames per second is still far above what a 3 Hz pulse needs.
    workBudgetMs: 12,
    workRecoverMs: 7,          // go back to every frame when work drops below this
    cameraFps: 30,             // requested capture rate; more frames give no better pulse and cost exposure
  },
  align: {
    centerTol: 0.10,           // face widths
    scaleTol: 0.07,            // relative apparent size
    rollTolDeg: 5,
    yawTolDeg: 6,
    pitchTol: 0.05,            // nose position index
    defaultCenter: { x: 0.5, y: 0.40 },
    defaultFaceWidthLandscape: 0.24,
    defaultFaceWidthPortrait: 0.45,
    defaultTolMultiplier: 1.8, // looser framing when no baseline exists yet
    holdSlack: 1.35,           // once aligned, stay aligned until the error passes this multiple of tolerance
  },
  pulse: {
    fs: 30,
    loHz: 0.7,                 // 42 bpm
    hiHz: 3.0,                 // 180 bpm
    windowSec: 10,
    stepSec: 2,
    minUsableFracInWindow: 0.9,
    minWindowSnrDb: -1,
    maxSpreadBpm: 8,           // interquartile range of window estimates
  },
  resp: {
    fs: 10,
    loHz: 0.1,                 // 6 breaths/min
    hiHz: 0.7,                 // 42 breaths/min
    minSeconds: 20,
    minSnrDb: -1,
    maxCountDisagreement: 4,   // breaths/min between spectral and zero crossing estimates
    profileRows: 80,
    maxLagRows: 4,
  },
  dental: {
    minMouthGapRatio: 0.06,    // inner lip gap over mouth width, so teeth are visible
    frontMaxYawDeg: 8,
    sideMinYawDeg: 15,
    sideMaxYawDeg: 40,
    maxGlareFrac: 0.03,
    minLuma: 60,
    goodFramesNeeded: 12,
    cropWidth: 960,
    cropHeight: 540,
    mouthWidthInCrop: 0.62,
    distTol: 0.12,             // face distance must match the baseline's within 12% (iris size in the picture), MODELED
    hfovDeg: 65,               // assumed camera field of view, only for the rough distance in cm shown on screen
  },
};
