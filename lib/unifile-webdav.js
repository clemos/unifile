'use strict';
/**
 * Service connector for WebDAV server
 */
const request = require('request');
const Promise = require('bluebird');

const NAME = 'webdav';

const callAPI = Symbol('callAPI');
const makePathAbsolute = Symbol('makePathAbsolute');

class WebDavConnector {
  constructor(config) {
    this.config = config;
    this.name = NAME;
  }

  getInfos(session) {
    return {
      name: NAME,
      displayName: 'WebDAV',
      icon: '../assets/webdav.png',
      description: 'Edit files on a WebDAV server',
      isLoggedIn: (session && 'token' in session),
      isOAuth: false,
      username: this.session.username
    };
  }

  getAuthorizeURL(session) {
    console.log('Returning', this.config.redirectUri);
    return Promise.resolve(this.config.redirectUri);
  }

  setAccessToken(session, token) {
    session.token = token;
    console.log('Token set', session.token);
    return Promise.resolve(token);
  }

  /**
   * Log in the WebDAV server
   * @param {Object} session - the user session
   * @param {Object} loginInfos - Options passed to the connection method
   */
  login(session, loginInfos){
    session.host = loginInfos.host;
    session.port = loginInfos.port;
    session.user = loginInfos.user;
    session.password = loginInfos.password;
    console.log('Session', session);
    return Promise.resolve(this.setAccessToken(session, loginInfos.user));
  }

  // Filesystem commands

  readdir(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'PROPFIND')
    .then((list) => {
      return list.reduce((memo, entry) => {
        if(entry.name.charAt(0) != '.')
          memo.push({
            size: entry.size,
            modified: entry.date,
            name: entry.name,
            isDir: entry.type == 'd',
            mime: mime.lookup(entry.name)
          });
        return memo;
      }, []);
    });
  }

  mkdir(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'MKCOL');
  }

  writeFile(session, path, data) {
    return this[callAPI](session, this[makePathAbsolute](path), data, 'PUT');
  }

  createWriteStream(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'PUT', true);
  }

  readFile(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'GET');
  }

  createReadStream(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'GET', true);
  }

  rename(session, src, dest) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'MOVE', {
      'Destination': this[makePathAbsolute](destination)
    });
  }

  unlink(session, path) {
    return this[callAPI](session, this[makePathAbsolute](path), {}, 'DELETE');
  }

  rmdir(session, path) {
    return unlink(session, path);
  }

  batch(session, actions, message) {
    return Promise.reject('Unimplemented');
  }

  /**
   * Make a call to the WebDAV server
   * @param {Object} session - WebDAV session storage
   * @param {string} path - End point path
   * @param {Object} data - Data to pass. Will be ignored if method is GET
   * @param {string} method - HTTP verb to use
   * @param {boolean} [isStream=false] - Use the API as a stream
   * @param {Object} [headers={}] - Additionals headers to send
   * @return {Promise|Stream} a Promise of the result send by server or a stream to the endpoint
   */
  [callAPI](session, path, data, method, isStream = false, headers = {}) {
    let opts = {
      url: session.host + ':' + session.port + path,
      method: method,
      auth: {
        user: session.user,
        password: session.password
      },
      headers: headers
    }

    if(isStream) return request(opts);
    else {
      opts.body = data;
      return new Promise((resolve, reject) => {
        request(opts, (err, res, body) => {
          if(err) return reject(err);

          if(res.statusCode >= 400) {
            const error = new Error(JSON.parse(body).message);
            error.statusCode = res.statusCode;
            return reject(error);
          }

          return resolve(body);
        })
      });
    }
  }

  [makePathAbsolute](path) {
    if(path[path.length-1] !== '/') return path + '/';
    else return path;
  }
}

module.exports = WebDavConnector;
