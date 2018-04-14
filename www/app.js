
function validateEmail(email) {
    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
}

function getLocationError()
{
    alert('Please enable location access.');
}

function getLocationSuccess(position)
{
    userCoords = position.coords;

    if (!lastUserCoords)
        lastUserCoords = userCoords;

    // set the map to center onto the users current location
    map.setCenter({
        // subtract 0.005 to compensate for the input fields on the screen
        lat: position.coords.latitude - 0.005, 
        lng: position.coords.longitude
    });

    latField.val(position.coords.latitude.toFixed(8));
    lonField.val(position.coords.longitude.toFixed(8));

    map.setZoom(14);

    // remove old marker
    currentLocationMarker.setMap(null);

    // create new marker at the current position
    currentLocationMarker = new google.maps.Marker({
        position: new google.maps.LatLng(position.coords.latitude, position.coords.longitude),
        map: map,
        draggable: false
    });
}

function getLocation()
{
    navigator.geolocation.getCurrentPosition(getLocationSuccess, getLocationError);
}

function checkForMovement()
{
    var difference = 
          Math.abs(lastUserCoords.latitude - userCoords.latitude)
        + Math.abs(lastUserCoords.longitude - userCoords.longitude);
    
    // check if the user has moved ~5 meters
    if (difference < 0.003)
    {
        if (!checkConditionDialog)
            checkConditionDialog = app.dialog.create({
            title: 'Hey!',
            text: 'It looks like you haven\'t moved in a while, are you okay?',
            on: {
                opened: function () {
                    // automatically alert emergency contact after 20 seconds
                    // if the user doesn't pick an option
                    alertInterval = setInterval(alertContact, 20000);
                }
            },
            buttons: [
                {
                    text: "I'm fine.",
                    onClick: function()
                    {
                        clearInterval(alertInterval);
                        alertInterval = null;
                        checkConditionDialog = undefined;
                    }
                },
                {
                    text: 'Alert my emergency contact!',
                    onClick: function()
                    {
                        clearInterval(alertInterval);
                        alertInterval = null;
                        checkConditionDialog = undefined;
                        alertContact();
                    }
                },
            ],
            verticalButtons: true,
            }).open();
    }

    lastUserCoords = userCoords;
}

function alertContact()
{
    clearInterval(alertInterval);
    alertInterval = null

    if (checkConditionDialog) {
        checkConditionDialog.close();
    }

    app.dialog.alert("Alerting contact '" + user.photoURL + "' ...", "Note");

    app.request.get('alert-contact', {
        person_name: user.displayName,
        contact_name: user.photoURL,
        contact_phone: user.phoneNumber 
    }, function (data) {
        app.dialog.close();
        app.dialog.alert("Contact was alerted!", "Note");
    });

    stopTrackingAfterAlertInterval = setInterval(function() {
        app.dialog.close();

        clearInterval(getLocationInterval);
        clearInterval(checkForMovementInterval);
        $$('.start-tracking-check').prop('checked', false);
        app.dialog.alert("Tracking is disabled!", "Note");

        clearInterval(stopTrackingAfterAlertInterval);
    }, 5000);
}

var map;
var getLocationInterval;
var checkForMovementInterval;
var stopTrackingAfterAlertInterval;
var currentLocationMarker;
var $$ = Dom7;

var latField;
var personField;
var lanField;
var formData;
var userCoords;
var lastUserCoords;
var alertInterval;
var checkConditionDialog;

firebase.initializeApp({
    apiKey: "AIzaSyBrTCZMb6Zldaf2hv0oHWTpuY_eHKF48nk",
    authDomain: "safetytracker-85558.firebaseapp.com",
    databaseURL: "https://safetytracker-85558.firebaseio.com",
    projectId: "safetytracker-85558",
    storageBucket: "",
    messagingSenderId: "997512859249"
});


firebase.auth().onAuthStateChanged(function(user) {
    window.user = user;
});

var app = new Framework7({
    root: '#app',
    theme: 'ios',

    routes: [
        {
            path: '/main',
            url: 'main.html',
            on: {
                pageAfterIn: function (e, page) {
                    map = new google.maps.Map(document.getElementById('map'), {
                        zoom: 2,
                        // where the map should point to when the app is initially started
                        center: { lat: 2, lng: 1 }
                    });

                    currentLocationMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(1, 1),
                        map: null,
                        draggable: false
                    });

                    latField = $$('#lat');
                    lonField = $$('#lon');

                    $$('#person').val(user.displayName);

                    $$('.start-tracking-check').on('click', function(e) {
                        if (e.target.checked) {
                            getLocation();
                            page.app.dialog.alert("Tracking is enabled", "Note");
                            // keep getting location every 5000 milliseconds (5 seconds)
                            getLocationInterval = setInterval(getLocation, 5000);
                            // check for movement every 30 seconds
                            checkForMovementInterval = setInterval(checkForMovement, 30000);
                        } else {
                            // stop getting location
                            latField.val('n/a');
                            lonField.val('n/a');
                            clearInterval(getLocationInterval);
                            clearInterval(checkForMovementInterval);
                            page.app.dialog.alert("Tracking is disabled", "Note");
                        }
                    });
                },
            },
        },

        {
            path: '/login',
            url: 'login.html',

            on: {
                pageAfterIn: function (e, page) {
                    $$('.log-in-button').on('click', function(){
                        formData = app.form.convertToData('#login-details');
                
                        for (var name in formData) {
                            if (formData[name] == "") {
                                page.app.dialog.alert("Email and password are required!", "Error");
                                return;
                            }
                        }
                
                        if (!validateEmail(formData['email'])) {
                            page.app.dialog.alert("Not a valid email address!", "Error");
                            return;
                        }

                        app.preloader.show();

                        firebase.auth().signInWithEmailAndPassword(formData['email'], formData['password'])
                        .then(function(user) {
                            app.preloader.hide();
                            mainView.router.navigate('/main', { ignoreCache: true, context: user });
                        })
                        .catch(function(err) {
                            app.preloader.hide();
                            page.app.dialog.alert(err.message, "Error!");
                        });

                    });
                }
            }
        },
        {
            path: '/signup',
            url: 'signup.html',
            on: {
                pageAfterIn: function (e, page) {
                    $$('.sign-up-button').on('click', function(){
                        formData = app.form.convertToData('#details');
                        
                        for (var name in formData) {
                            if (formData[name] == "") {
                                app.dialog.alert("All fields are required!", "Error!");
                                return;
                            }
                        }

                        if (!validateEmail(formData['email'])) {
                            app.dialog.alert("Not a valid email address!", "Error!");
                            return;
                        }

                        app.preloader.show();

                        firebase.auth().createUserWithEmailAndPassword(formData['email'], formData['password']).then(function (user) {
                            user.updateProfile({
                                displayName: formData['first_name'] + ' ' + formData['last_name'],
                                photoURL: formData['cfirst_name'] + ' ' + formData['clast_name'],
                                phoneNumber: formData['cphone'],
                            });

                            app.preloader.hide();
                            
                            page.app.dialog.alert("You can now log in", "Success");
                            mainView.router.navigate('/login', { ignoreCache: true });
                        }).catch(function (err) {
                            app.preloader.hide();
                            app.dialog.alert(err.message, "Error!");
                        });
                    });
                }
            }
        },
    ]

});

var mainView = app.views.create('.view-main');
