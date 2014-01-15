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

  function init(options) {
    firebaseBase = new Firebase(options.firebase.id);
    firebaseAuth = new FirebaseSimpleLogin(firebaseBase, onAuthChange);

    document.querySelector('#login').addEventListener('click', loginPlayer);
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

      document.body.classList.remove('not-logged-in');
      document.body.classList.add('logged-in');
    } else {
      document.body.classList.remove('logged-in');
      document.body.classList.add('not-logged-in');
    }
  }

  function loginPlayer() {
    firebaseAuth.login('facebook', {
      rememberMe: true
    });
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
    var el = document.createElement('li');
    el.dataset.userId = requestingUserId;
    el.innerHTML = 'New request from: <b>' + requestingUserId + '</b>';
    el.addEventListener('click', function onAcceptClick(e) {

    });

    var elList = document.querySelector('#me .invites');
    elList.insertBefore(el, elList.firstChild);

    var elUserFromList = UserList.getUserElement(requestingUserId);
    console.log(elUserFromList);
    if (elUserFromList) {
      elUserFromList.classList.add('request-pending');
    }
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
      firebaseRef = firebaseBase.child('users/');
      firebaseRef.on('child_changed', function(snapshot, prevChildName) {
        var user = snapshot.val();
        
        if (user.id !== player.getData().id) {
          if (user.online) {
            addUser(user)
          } else {
            removeUser(user);
          }
        }
      });
    }

    function update() {
      firebaseRef = firebaseBase.child('users/');
      firebaseRef.on('child_added', function(snapshot) {
        var user = snapshot.val();
        if (user.online && user.id !== player.getData().id) {
          addUser(snapshot.val());
        }
      });
    }

    function addUser(user) {
      var li = getUserElement(user.id);
      if (li) {
        li = li.parentNode.removeChild(li);
      } else {
        li = document.createElement('li');

        li.dataset.id = user.id;
        li.innerHTML = '<div class="name">' +
                         (user.name || user.id) +
                         '<b class="button match">Match</b>' +
                       '</div>';
      }

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
    this.setUser = setUser;

    function init(options) {
      !options && (options = {});

      id = options.id || '';
      name = options.name || '';
      isPlayer = !!options.player;
      cbReady = options.onReady || function(){};
      cbNewRequest = options.onNewRequest || function(){};
      cbDeleteRequest = options.onDeleteRequest || function(){};

      if (id) {
        verifyUser(onPlayerReady);
      } else {
        getFromStorage(function onReady() {
          if (id) {
            onPlayerReady();
          } else {
            newUser(onPlayerReady);
          }
        });
      }
    }

    function getData() {
      return {
        id: id,
        name: name,
        isPlayer: isPlayer
      };
    }

    function addRequest(userId) {
      firebaseRef.child('requests-out').child(userId).set(REQUEST_STATUS.PENDING);
    }

    function removeRequest(userId) {
      firebaseRef.child('requests-out').child(userId).set(REQUEST_STATUS.CANCEL);
    }

    function onPlayerReady() {
      console.log('Player ready: ', getData());

      // change status to "offline" when disconnecting
      firebaseRef.onDisconnect().update({
        'online': false,
        'requests-out': {}
      });

      // notify when other users want to match
      firebaseRef.child('requests-in').on('child_added', function(snapshot) {
        // .name because we add an object here that the requesting user's ID is its key
        var user = snapshot.name();
        cbNewRequest(user);
      });
      // notify when a request has been deleted
      firebaseRef.child('requests-in').on('child_removed', function(snapshot) {
        var user = snapshot.name();
        cbDeleteRequest(user);
      });

      cbReady();
    }

    function verifyUser(onReady) {
      firebaseRef = firebaseBase.child('users').child(id);

      // see if this user exists in the DB
      // if not - let's create it!
      firebaseRef.once('value', function(data) {
        data = data.val();

        if (data && data.id) {
          name = data.name;

          firebaseRef.update({
            'online': true,
            'requests-in': {}
          }, onReady);
        } else {
          save();
        }
      });
    }

    function getFromStorage(onReady) {
      id = Storage.get(USER_ID_KEY);

      if (id) {
        verifyUser();
      } else {
        onReady();
      }

      return !!id;
    }

    function newUser(onReady) {
      id = window.URL.createObjectURL(new Blob());
      id = id.replace('blob:', '');
      id = id.split('/');
      id = id[id.length - 1];
      name = '';

      Storage.set(USER_ID_KEY, id);


      // save an initial user to Firebase
      save();

      return true;
    }

    function save() {
      if (!id) {
        return;
      }

      if (!firebaseRef) {
        firebaseRef = firebaseBase.child('users').child(id);
      }

      var data = {
        'id': id,
        'name': name,
        'online': true,
        'requests-in': {}
      };

      firebaseRef.set(data, onPlayerReady);
    }

    function setUser(newUserData) {
      userData = newUserData;

      name = userData.displayName;

      var data = {
        'name': name,
        'online': true
      };

      firebaseRef.update(data);
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

      firebaseRef = firebaseGames.push(data);
      id = firebaseRef.name();

      console.log(firebaseRef.name(), firebaseRef);
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
    newGame: newGame
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