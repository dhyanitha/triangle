/*global jasmine, __karma__, window*/
Error.stackTraceLimit = Infinity;

// The default time that jasmine waits for an asynchronous test to finish is five seconds.
// If this timeout is too short the CI may fail randomly because our asynchronous tests can
// take longer in some situations (e.g Saucelabs and Browserstack tunnels)
// jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

__karma__.loaded = function () {
};

var baseDir = '/base';
var specFiles = Object.keys(window.__karma__.files).filter(isSpecFile);

// Configure the base path and map the different node packages.
System.config({
  warnings: true,
  baseURL: baseDir,
  paths: {
    // 'node:*': 'node_modules/*'
  },
  map: {
    // 'rxjs': 'node:rxjs',
    // 'main': 'main.js',
    'tslib': 'node_modules/tslib/tslib.js',
    // 'chai': 'node_modules/chai/index.js',
    // 'moment': 'node:moment/min/moment-with-locales.min.js',

    '@gradii/moltre': 'dist/packages/moltre/public-api.js'
  },
  packages: {
    // Thirdparty barrels.
    'rxjs': {main: 'index'},

    // Set the default extension for the root package, because otherwise the demo-app can't
    // be built within the production mode. Due to missing file extensions.
    '.': {
      defaultExtension: 'js'
    }
  }
});

// Configure the Angular test bed and run all specs once configured.
runSpecs()
  .then(__karma__.start, function (error) {
    // Passing in the error object directly to Karma won't log out the stack trace and
    // passing the `originalErr` doesn't work correctly either. We have to log out the
    // stack trace so we can actually debug errors before the tests have started.
    console.error(error.originalErr.stack);
    __karma__.error(error);
  });


/** Runs the Angular Material specs in Karma. */
function runSpecs() {
  // By importing all spec files, Karma will run the tests directly.
  return Promise.all(specFiles.map(function (fileName) {
    return System.import(fileName);
  }));
}

/** Whether the specified file is part of Angular Material. */
function isSpecFile(path) {
  return path.slice(-8) === '.spec.js' && path.indexOf('node_modules') === -1;
}

/**
 * Monkey-patches TestBed.resetTestingModule such that any errors that occur during component
 * destruction are thrown instead of silently logged. Also runs TestBed.resetTestingModule after
 * each unit test.
 *
 * Without this patch, the combination of two behaviors is problematic for Angular Material:
 * - TestBed.resetTestingModule catches errors thrown on fixture destruction and logs them without
 *     the errors ever being thrown. This means that any component errors that occur in ngOnDestroy
 *     can encounter errors silently and still pass unit tests.
 * - TestBed.resetTestingModule is only called *before* a test is run, meaning that even *if* the
 *    aforementioned errors were thrown, they would be reported for the wrong test (the test that's
 *    about to start, not the test that just finished).
 */
function patchTestBedToDestroyFixturesAfterEveryTest(testBed) {
  // Original resetTestingModule function of the TestBed.
  var _resetTestingModule = testBed.resetTestingModule;

  // Monkey-patch the resetTestingModule to destroy fixtures outside of a try/catch block.
  // With https://github.com/angular/angular/commit/2c5a67134198a090a24f6671dcdb7b102fea6eba
  // errors when destroying components are no longer causing Jasmine to fail.
  testBed.resetTestingModule = function () {
    try {
      this._activeFixtures.forEach(function (fixture) {
        fixture.destroy();
      });
    } finally {
      this._activeFixtures = [];
      // Regardless of errors or not, run the original reset testing module function.
      _resetTestingModule.call(this);
    }
  };

  // Angular's testing package resets the testing module before each test. This doesn't work well
  // for us because it doesn't allow developers to see what test actually failed.
  // Fixing this by resetting the testing module after each test.
  // https://github.com/angular/angular/blob/master/packages/core/testing/src/before_each.ts#L25
  afterEach(function () {
    testBed.resetTestingModule();
  });
}
