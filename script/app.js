var App = (function() {
  var firebaseBase,
      firebaseAuth,
      player;

  var REQUEST_STATUS = {
        CANCEL: null,
        PENDING: 1,
        DENIED: 20,
        APPROVED: 30
      },
      GAME_STATUS = {
        NEW: 1
      };

  // just a small helper object, so all objects can use this instead of
  // binding directly to mouse or touch events
  var hasTouch = 'ontouchstart' in document.body;
  window.EVENTS = {
    POINTER_DOWN: hasTouch? 'touchstart' : 'mousedown',
    POINTER_MOVE: hasTouch? 'touchmove' : 'mousemove',
    POINTER_END: hasTouch? 'touchend' : 'mouseup'
  };

  function init(options) {
    firebaseBase = new Firebase(options.firebase.id);
    firebaseAuth = new FirebaseSimpleLogin(firebaseBase, onAuthChange);
  }

  function onAuthChange(error, user) {
    if (user) {
      player = new User({
        'player': true,
        'id': user.id,
        'name': user.displayName,
        'data': user,
        'onReady': onPlayerReady,
        'onNewRequest': onPlayreNewRequest,
        'onDeleteRequest': onPlayerDeleteRequest
      });

      document.querySelector('#new-button').addEventListener('click', newGame);

      document.body.classList.remove('not-logged-in');
      document.body.classList.add('logged-in');
    } else {
      document.querySelector('#login-facebook').addEventListener('click', loginPlayerFacebook);
      document.querySelector('#login-twitter').addEventListener('click', loginPlayerTwitter);

      document.body.classList.remove('logged-in');
      document.body.classList.add('not-logged-in');
    }
  }

  function loginPlayerFacebook() { loginPlayer('facebook'); }
  function loginPlayerTwitter() { loginPlayer('twitter'); }

  function loginPlayer(provider) {
    firebaseAuth.login(provider, {
      rememberMe: true
    });
  }

  function logoutPlayer() {
    firebaseAuth.logout();
  }

  function onPlayerReady() {
    var playerData = player.getData(),
        elName = document.querySelector('#me .name');

    elName.innerHTML = 'Me: ' +
                        '<img src="http://graph.facebook.com/' + playerData.id + '/picture" /> ' +
                        (playerData.name || playerData.id);

    UserList.init({
      'el': document.querySelector('#users ul')
    });
  }

  function sendMatchRequest(userId) {
    var firebaseUserRef = firebaseBase.child('users/' + userId + '/requests-in'),
        playerId = player.getData().id,
        data = {};

    // send the request to the other user
    data[playerId] = REQUEST_STATUS.PENDING;
    firebaseUserRef.update(data);

    // cancel the rquest when disconnecting
    data[playerId] = REQUEST_STATUS.CANCEL;
    firebaseUserRef.onDisconnect().update(data);

    // update my own "requesting"
    player.addRequest(userId);

    // indicate in the UI
    UserList.markUserAsRequested(userId);
  }

  function cancelMatchRequest(userId) {
    var firebaseUserRef = firebaseBase.child('users/' + userId + '/requests-in'),
        playerId = player.getData().id,
        data = {};

    // cancel the rquest for the requested user
    data[playerId] = REQUEST_STATUS.CANCEL;
    firebaseUserRef.update(data);

    // update my own "requesting"
    player.removeRequest(userId);

    // indicate in the UI
    UserList.cancelUserAsRequested(userId);
  }

  function onPlayreNewRequest(requestingUserId) {
    firebaseBase.child('users').child(requestingUserId).once('value', function onGotUser(user) {
      user = user.val();
      if (!user) {
        return;
      }
      
      var el = document.createElement('li');

      el.dataset.userId = requestingUserId;
      el.innerHTML = 'New request from: <b>' + user.name + '</b>';
      el.addEventListener('click', function onAcceptClick(e) {
        // handle accept request
      });

      var elList = document.querySelector('#me .invites');
      elList.insertBefore(el, elList.firstChild);

      var elUserFromList = UserList.getUserElement(user.id);
      if (elUserFromList) {
        elUserFromList.classList.add('request-pending');
      }
    });
  }

  function onPlayerDeleteRequest(requestingUserId) {
    var elRequest = document.querySelector('#me .invites li[data-user-id = "' + requestingUserId + '"]');
    if (elRequest) {
      elRequest.parentNode.removeChild(elRequest);
    }

    var elUserFromList = UserList.getUserElement(requestingUserId);
    if (elUserFromList) {
      elUserFromList.classList.remove('request-pending');
    }
  }

  var UserList = (function() {
    var el;

    function init(options) {
      el = options.el;

      el.addEventListener('click', onClick);

      listenToChanges();
      update();
    }

    function onClick(e) {
      var elClicked = e.target;

      if (elClicked.classList.contains('match')) {
        var elLi = elClicked.parentNode.parentNode,
            userId = elLi.dataset.id;

        if (!elLi.classList.contains('request-pending')) {
          if (elLi.classList.contains('requested')) {
            cancelMatchRequest(userId);
          } else {
            sendMatchRequest(userId);
          }
        }
      }
    }

    function listenToChanges() {
      firebaseBase.child('users').on('child_changed', function(snapshot, prevChildName) {
        var user = snapshot.val();
        
        if (user.id === player.getData().id) {
          return;
        }

        if (user.online) {
          addUser(user)
        } else {
          removeUser(user);
        }
      });
    }

    function update() {
      firebaseBase.child('users').on('child_added', function(snapshot) {
        var user = snapshot.val();
        if (user.online && user.id !== player.getData().id) {
          addUser(snapshot.val());
        }
      });
    }

    function addUser(user) {
      var li = getUserElement(user.id);
      if (li) {
        return;
      }

      li = document.createElement('li');

      li.dataset.id = user.id;
      li.innerHTML = '<div class="name">' +
                       (user.name || user.id) +
                       '<b class="button match">Match</b>' +
                     '</div>';

      el.insertBefore(li, el.firstChild);
    }

    function removeUser(user) {
      var li = getUserElement(user.id);
      if (li) {
        li.classList.add('offline');
        window.setTimeout(function() {
          li.parentNode.removeChild(li);
        }, 200);
      }
    }

    function markUserAsRequested(userId) {
      var elUser = getUserElement(userId);
      if (elUser) {
        elUser.classList.add('requested');
      }
    }

    function cancelUserAsRequested(userId) {
      var elUser = getUserElement(userId);
      if (elUser) {
        elUser.classList.remove('requested');
      }
    }

    function getUserElement(userId) {
      return el.querySelector('li[data-id = "' + userId + '"]');
    }

    return {
      'init': init,
      'update': update,
      'addUser': addUser,
      'getUserElement': getUserElement,
      'markUserAsRequested': markUserAsRequested,
      'cancelUserAsRequested': cancelUserAsRequested
    };
  }());

  function User(options) {
    var id,
        name,
        userData,
        firebaseRef,
        isPlayer,

        cbReady,
        cbNewRequest,
        cbDeleteRequest,

        USER_ID_KEY = 'userId';

    this.init = init;
    this.getData = getData;
    this.addRequest = addRequest;
    this.removeRequest = removeRequest;

    function init(options) {
      !options && (options = {});

      id = options.id || '';
      name = options.name || '';
      isPlayer = !!options.player;
      cbReady = options.onReady || function(){};
      cbNewRequest = options.onNewRequest || function(){};
      cbDeleteRequest = options.onDeleteRequest || function(){};

      verify();
    }

    function verify() {
      firebaseRef = firebaseBase.child('users').child(id);

      firebaseRef.once('value', function(data) {
        data = data.val() || {};

        // user not in DB - create them
        if (!data.name) {
          firebaseRef.child('name').set(name);
        }
        if (!data.id) {
          firebaseRef.child('id').set(id);
        }

        // indicate user is now online
        firebaseRef.child('online').set(true);

        onPlayerReady();
      });
    }

    function onPlayerReady() {
      console.log('Player ready: ', getData());

      // when disconnecting: change status to "offline" and delete all requests
      firebaseRef.onDisconnect().update({
        'online': false,
        'requests-out': null,
        'requests-in': null
      });

      // notify when other users want to match
      firebaseRef.child('requests-in').on('child_added', function(snapshot) {
        cbNewRequest(snapshot.name());
      });
      
      // notify when a request has been canceled
      firebaseRef.child('requests-in').on('child_removed', function(snapshot) {
        cbDeleteRequest(snapshot.name());
      });

      cbReady();
    }

    function getData() {
      return {
        id: id,
        name: name,
        isPlayer: isPlayer
      };
    }

    function addRequest(userId) {
      setRequestStatus(userId, REQUEST_STATUS.PENDING);
    }

    function removeRequest(userId) {
      setRequestStatus(userId, REQUEST_STATUS.CANCEL);
    }

    function setRequestStatus(userId, status) {
      firebaseRef.child('requests-out').child(userId).set(status);
    }

    init(options);
  }

  function Game(options) {
    var firebaseRef,
        id;

    function init(options) {
      var firebaseGames = firebaseBase.child('games'),
          data = {
            userFrom: options.userFrom,
            userTo: options.userTo,
            status: GAME_STATUS.NEW
          };

      //firebaseRef = firebaseGames.push(data);
      //id = firebaseRef.name();

      initDrawing();
    }

    function initDrawing() {
      player.drawing = new Drawing({
        'elContainer': document.querySelector('#drawing'),
        'type': 'save'
      });

      document.querySelector('#new').classList.add('visible');
    }

    init(options);
  }

  function newGame() {
    var game = new Game({
      userFrom: player.getData().id,
      userTo: player.getData().id
    });
  }

  return {
    init: init,
    newGame: newGame,
    logoutPlayer: logoutPlayer
  };
}());

// helpers
var Storage = (function(){
  function set(key, value) {
    if (typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch(ex) {
        console.error('Trying to serialize: ', value);
      }
    }

    try {
      localStorage[key] = value;
    } catch(ex) {
      console.warn('Can\'t use localStorage?', ex);
    }
  }

  function get(key) {
    var value = null;

    try {
      value = localStorage[key];
    } catch(ex) {
      console.warn('Can\'t use localStorage?', ex);
    }

    if (value) {
      try {
        value = JSON.parse(value);
      } catch(ex) {}
    }

    return value;
  }

  function remove(key) {
    localStorage.remove(key);
  }

  return {
    set: set,
    get: get,
    remove: remove
  };
}());