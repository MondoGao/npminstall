const debug = require('util').debuglog('npminstall:format_install_options');
const os = require('os');
const { randomUUID } = require('crypto');
const awaitEvent = require('await-event');
const assert = require('assert');
const path = require('path');
const EventEmitter = require('events');
const ora = require('ora');
const globalConfig = require('./config');

module.exports = function formatInstallOptions(options) {
  options.trace = !!options.trace;
  if (options.trace) {
    // make sure detail enable when trace enable
    options.detail = true;
  }

  options.spinner = options.detail ? null : ora();
  options.events = new EventEmitter();
  // close EventEmitter memory leak warning
  options.events.setMaxListeners(0);
  options.events.await = awaitEvent;

  options.postInstallTasks = [];
  // [
  //    {package: pkg, parentDir: 'parentDir', packageDir: 'packageDir'},
  //   ...
  // ]
  options.peerDependencies = [];
  // {
  //   pkg: Set('version1', 'version2')
  // }
  options.packageVersions = {};

  // support forbiddenLicenses
  if (options.forbiddenLicenses && options.forbiddenLicenses.length) {
    options.forbiddenLicensesRegex = new RegExp(options.forbiddenLicenses.join('|'), 'i');
  }

  options.latestVersions = new Map();
  // store latest packages
  options.latestPackages = new Map();
  options.cache = {
    dependenciesTree: {},
  };

  // use depsTree
  if (options.dependenciesTree) {
    Object.assign(options.cache.dependenciesTree, options.dependenciesTree);
  }

  assert(options.root && typeof options.root === 'string', 'options.root required and must be string');
  options.registry = options.registry || 'https://registry.npmjs.com';
  // try to read _authToken
  // '//packages.aliyun.com/xxxxxx/npm/npm-registry/:_authToken': 'xxxxx'
  const registryKey = options.registry.replace('https://', '').replace('http://', '');
  options.registryAuthorization = globalConfig.npmrc[`//${registryKey}/:_authToken`]
    || globalConfig.npmrc[`//${registryKey}:_authToken`];

  if (!options.targetDir) {
    options.targetDir = options.root;
  }
  if (!options.storeDir) {
    options.storeDir = path.join(options.targetDir, 'node_modules');
  }
  options.timeout = options.timeout || 60000;
  options.streamingTimeout = options.streamingTimeout || 120000;
  const customConsole = options.detail ? console : {
    info: debug,
    log: debug,
    error: console.error,
    warn: console.warn,
  };
  options.console = options.console || customConsole;
  options.env = options.env || {};
  options.start = Date.now();
  options.totalTarballSize = 0;
  options.totalJSONSize = 0;
  options.totalJSONCount = 0;
  options.totalCacheJSONCount = 0;
  options.totalEtagHitCount = 0;
  options.totalEtagMissCount = 0;
  options.localPackages = 0;
  options.remotePackages = 0;
  options.registryPackages = 0;
  options.gitPackages = 0;
  options.binaryMirrors = options.binaryMirrors || {};
  const defaultCacheDir = path.join(os.homedir(), '.npminstall_tarball');
  if (options.cacheStrict) {
    options.cacheDir = options.cacheDir || defaultCacheDir;
  } else {
    if (options.production) {
      options.cacheDir = '';
    } else {
      if (typeof options.cacheDir !== 'string') {
        options.cacheDir = defaultCacheDir;
      }
    }
  }
  // https://github.com/sass/node-sass/blob/master/lib/extensions.js#L270
  // make sure npm_config_cache env exists
  options.env.npm_config_cache = options.env.npm_config_cache || options.cacheDir || defaultCacheDir;

  // https://github.com/cnpm/cnpm/issues/317
  options.env.INIT_CWD = process.cwd();

  options.pendingMessages = [];

  // log packages update in 7 days
  options.recentlyUpdateMinDateTime = options.recentlyUpdateMinDateTime || Date.now() - 7 * 24 * 3600000;
  // { name@version:  }
  options.recentlyUpdates = new Map();
  // production mode: log all message to console
  // other: only show today message to console
  options.onlyShowTodayUpdateToConsole = !options.production;
  // record all the packages' name which install from remote/git
  options.remoteNames = {};

  // public-hoist-pattern default: ['*eslint*', '*prettier*']
  // https://pnpm.io/zh/next/npmrc#public-hoist-pattern
  // add babel
  options.publicHoistPattern = /(eslint|prettier|babel)/i;
  options.publicHoistLatestVersions = new Map();

  options.pkgs = options.pkgs || [];

  options.referer = 'install';
  if (options.pkgs.length > 0) {
    options.referer += ' ' + options.pkgs.map(pkg => pkg.name).join(' ');
  }
  if (options.production) {
    options.referer += ' --production';
  }
  options.referer += ` --uuid=${randomUUID()}`;

  options.installRoot = options.pkgs.length === 0;

  options.progresses = {
    installTasks: 0,
    finishedInstallTasks: 0,
    linkTasks: 0,
    finishedLinkTasks: 0,
  };

  options.rawCount = 0;
  options.rawSize = 0;
  options.pruneCount = 0;
  options.pruneSize = 0;

  return options;
};
