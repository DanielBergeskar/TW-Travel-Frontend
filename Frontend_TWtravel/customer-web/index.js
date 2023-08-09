let keycloak = new Keycloak({url: 'http://localhost:8080', realm: 'TravelAgencyRealm', clientId: 'TravelAgency'});

// Inloggad användare
currentUser = {
    'id': '',
    'username': '',
    'name': '',
    'address': '',
    'role': '',
    'token': '',
    'refreshToken': ''
};

let booking = {
    'bookingDate': {
        'startDate': '',
		'endDate': ''
	},
	'customer': {
		'id': ''
	},
	'destination': {
		'id': ''
	}
}

function initKeycloak(){
    keycloak.init({ onLoad: 'login-required' })
    .then(loadUser);
    return keycloak;
}

const loadUser = () => {
    if (keycloak.idToken) {
        currentUser.username = keycloak.tokenParsed.preferred_username;
        currentUser.role = keycloak.tokenParsed.realm_access.roles[2];
        currentUser.token = keycloak.token;
        currentUser.refreshToken = keycloak.refreshToken;

        loadCurrentCustomer();

    } else {
        keycloak.loadUserProfile(function() {
            console.log('Account Service');
            console.log(keycloak.profile.username);
        }, function() {
            console.log('Failed to retrieve user details.');
        });
    }
};

async function loadCurrentCustomer(){
    const url = 'http://localhost:8787/api/v2/customer'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + currentUser.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({"username": currentUser.username})
    })
    const customer = await response.json();

    currentUser.id = customer.id;
    currentUser.name = customer.name;
    currentUser.address = customer.address;
}

let chosenDestinationType;
$(function () {
    $('#header').load('navigation.html', () => {

        $('#bookings-link').click(myBookingsView);

        $('.search-destination-type').click(function (e) { 

            chosenDestinationType = $(this).text();
            $('#content').load('datepicker.html', searchDatesEvent);   
        });
    });
});

function searchDatesEvent() {
    // Valda datum
    $('#date-search').click(async function (e) {
        const dates = {
            'startDate': $('#search-start').val(),
            'endDate': $('#search-end').val()
        }

        // Om blankt
        if(dates.startDate === '' || dates.endDate === ''){
            $('#search-danger').remove();
            $('#content').append('<div id="search-danger" class="alert alert-danger w-25 text-center mx-auto" role="alert">Ange datum</div>');

        } else {

            // sortering
            const sortType = $('#sort-type').val();

            // Alla resor 
            const destinations = await getDestinations(dates);
    
            // Filtrera bort resor som inte stämmer med val
            const filteredDestinations = await filterDestinationType(destinations);

            const sortedDestinations = sortDestinations(filteredDestinations, sortType);

            // visa
            const htmlDestinations = availableDestinationsView(sortedDestinations);  
            $('#content').html(htmlDestinations);

            // Event för att boka resa
            $('.booking-btn').click(function (e) { 
                const row = $(this).parent().parent();
                const rowChildren = row.children();

                // Spara den valda resan
                let destinationValues = [];
                rowChildren.each(function(index, value) {
                    if(index < rowChildren.length - 1){
                        destinationValues.push(value.innerHTML);
                    }
                });

                // totala priset
                const totalPrice = calcTotalPrice(calcDaysBetween(dates), destinationValues[4]);
                destinationValues.push(totalPrice);

                // Spara värden för att kunna skicka booking 
                booking.bookingDate.startDate = dates.startDate;
                booking.bookingDate.endDate = dates.endDate;
                booking.customer.id = currentUser.id;
                booking.destination.id = destinationValues[0];

                const htmlBooking = confirmBookingView(destinationValues, dates);
                $('#content').html(htmlBooking);
            });   
        }
    });
}

async function filterDestinationType(destinations){
    return (chosenDestinationType === 'Alla Resor') ? destinations : destinations.filter(destination => destination.type === chosenDestinationType);
}

function sortDestinations(destinations, sortBy){
    if(sortBy === 'none'){
        return destinations;
    } else if(sortBy === 'city'){
        destinations.sort((c1, c2) => {
            const b1 = c1.city;
            const b2 = c2.city;

            if(b1 < b2){
                return -1
            }
            if(b1 > b2){
                return 1;
            }
            return 0;
        });
        return destinations;
    } else if (sortBy === 'price'){
        destinations.sort((c1, c2) => {
            return c1.dailyPrice - c2.dailyPrice;
        });
        return destinations;
    }
}

function availableDestinationsView(filteredDestinations) {
    let htmlDestinations = '<table class="table table-striped table-hover text-center"><thead><tr><th>#</th><th>Hotell</th><th>Stad</th><th>Land</th><th>Pris/dag</th><th></th></tr></thead><tbody>';

    filteredDestinations.forEach(destination => {
        htmlDestinations += '<tr><th>';
        htmlDestinations += destination.id;
        htmlDestinations += '</th><td>';
        htmlDestinations += destination.hotel;
        htmlDestinations += '</td><td>';
        htmlDestinations += destination.city;
        htmlDestinations += '</td><td>';
        htmlDestinations += destination.country;
        htmlDestinations += '</td><td>';
        htmlDestinations += destination.dailyPrice;
        htmlDestinations += '</td><td><button type="button" class="booking-btn btn btn-primary">Boka resa</button></td></>';
    });

    htmlDestinations += '</tbody></table>';

    return htmlDestinations;
}

function calcDaysBetween(dates) {  
    // Datum i år, månad, dag
    const startDateArray = dates.startDate.split('-');
    const endDateArray = dates.endDate.split('-');

    // Nya datum
    const startDate = new Date(startDateArray[0], startDateArray[1] - 1, startDateArray[2]);
    const endDate = new Date(endDateArray[0], endDateArray[1] - 1, endDateArray[2]);

    // Skillnaden i tid
    const timeDiff = endDate - startDate;

    // Skillnaden i dagar
    const daysDiff = timeDiff / (1000 * 3600 * 24) + 1;

    return daysDiff;
}
function isBookingActive(bookingStartDate, bookingEndDate){
    
    const bookingStartDateArray = bookingStartDate.split('-');
    const bookingEndDateArray = bookingEndDate.split('-');

    const startDate = new Date(bookingStartDateArray[0], bookingStartDateArray[1] - 1, bookingStartDateArray[2]);
    const endDate = new Date(bookingEndDateArray[0], bookingEndDateArray[1] - 1, bookingEndDateArray[2]);

    // Dagens datum
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Kolla om startdatumet är efter dagens datum
    return (startDate > today) ? true : false; 
}

function calcTotalPrice(days, dailyPrice) {
    return Math.round((days * dailyPrice) * 10) / 10;
}

async function confirmBooking(){
    const url = 'http://localhost:8787/api/v2//booktrip'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + currentUser.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(booking)
    });
    const bookingRes = await response.json();

    $('#content').html('<div class="alert alert-success m-5 text-center" role="alert">Resan är nu bokad. Du kan se den under <strong>"Mina Bokningar"</strong></div>');
}

function abortBooking() {
    $('#content').html('<div class="alert alert-danger m-5 text-center" role="alert">Bookningen är avbruten</strong></div>');
}

async function myBookingsView(){
    const bookings = await getMyBookings();

    let htmlBookings = '<div class="container-fluid"><div class="text-center"><h4 class="mt-4">Bokningar</h4></div><table class="text-center table table-sm table-hover table-striped"><thead><tr><th scope="col">#</th><th scope="col">Hotell</th><th scope="col">Stad</th><th scope="col">Avresa</th><th scope="col">Hemresa</th><th scope="col">Totalpris</th><th></th></tr></thead><tbody>';

    bookings.forEach(booking => {
        htmlBookings += '<tr><th>';
        htmlBookings += booking.id;
        htmlBookings += '</th><td>';
        htmlBookings += booking.destination.hotel;
        htmlBookings += '</th><td>';
        htmlBookings += booking.destination.city;
        htmlBookings += '</td><td>';
        htmlBookings += booking.bookingDate.startDate;
        htmlBookings += '</td><td>';
        htmlBookings += booking.bookingDate.endDate;
        htmlBookings += '</td><td>';

        dates = {
            'startDate': booking.bookingDate.startDate,
            'endDate': booking.bookingDate.endDate
        }
        htmlBookings += calcTotalPrice(calcDaysBetween(dates), booking.destination.dailyPrice);

        htmlBookings += '</td><td><button type="button" class="details-btn btn btn-secondary btn-sm">Detaljer för bokningen</button></td></tr>';
    });
    htmlBookings += '</tbody></table></div>';

    $('#content').html(htmlBookings);

    $('.details-btn').click(event => bookingDetailsView(event, bookings));
}

function confirmBookingView(destinationValues, dates){
    let htmlBooking = '<div class="container-fluid"><form class="w-75 mx-auto mt-5"><div class="row"><div class="mb-3 col"><label for="name" class="fw-bold form-label">Namn</label><input type="text" class="form-control" placeholder="';
    
    htmlBooking += currentUser.name;
    
    htmlBooking += '" disabled></div><div class="mb-3 col"><label for="address" class="fw-bold form-label">Adress</label><input type="text" class="form-control" placeholder="';

    htmlBooking += currentUser.address;
            
    htmlBooking += '" disabled></div></div><div class="row"><div class="mb-3 col"><label for="destination" class="fw-bold form-label">Resmål</label><input type="text" class="form-control" placeholder="';
            
    htmlBooking += destinationValues[1] + ' ' + destinationValues[2];
    
    htmlBooking += '" disabled></div><div class="mb-3 col"><label for="type" class="fw-bold form-label">Land</label><input type="text" class="form-control" placeholder="';

    htmlBooking += destinationValues[3];
    
    htmlBooking += '" disabled></div><div class="mb-3 col"><label for="daily-price" class="fw-bold form-label">Pris/dag</label><input type="text" class="form-control" placeholder="';
    
    htmlBooking += destinationValues[4];

    htmlBooking += '" disabled></div></div><div class="row"><div class="mb-3 col"><label for="start-date" class="fw-bold form-label">Startdatum</label><input type="text" class="form-control" placeholder="';
    
    htmlBooking += dates.startDate;

    htmlBooking += '" disabled></div><div class="mb-3 col"><label for="end-date" class="fw-bold form-label">Slutdatum</label><input type="text" class="form-control" placeholder="';
    
    htmlBooking += dates.endDate;

    htmlBooking += '" disabled></div></div><div class="mb-3"><label for="total-price" class="fw-bold form-label">Totalpris</label><input type="text" class="form-control" placeholder="';
       
    htmlBooking += destinationValues[5];
    
    htmlBooking += '" disabled></div><div class="row w-50"><div class="col-1"></div><input onclick="abortBooking()" type="button" value="Avbryt" class="col btn btn-danger"><div class="col-1"></div><input onclick="confirmBooking()" type="button" value="Bekräfta" class="col btn btn-primary"></input></div></form></div>';

    return htmlBooking;
}

function bookingDetailsView(event, bookings) {    

    // Hämtar aktuell bookings id
    
    const bookingId = $(event.target).parent().parent().children()[0].innerHTML;

    
    // Hämtar rätt booking från alla kundens bokningar

    const booking = bookings.find((booking) => booking.id == bookingId);

    
    //Är det en kommande bokning eller är den gammal?
    
    const isActive =  isBookingActive(booking.bookingDate.startDate, booking.bookingDate.endDate);

    let detailsHtml = '<div class="container-sm mt-4 shadow p-4"><div class="mb-4"><h4 id="booking-id">Bokning: #';

    detailsHtml += booking.id;
    detailsHtml += '</h4></div><form id="form"><div class="row mb-5"><div class="col"><label for="customer-id" class="form-label strong"><strong>kund-id</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += currentUser.id;
    detailsHtml += '"></div><div class="col"><label for="customer-name" class="form-label strong"><strong>Namn</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += currentUser.name;
    detailsHtml += '"></div><div class="col"><label for="customer-address" class="form-label"><strong>Adress</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += currentUser.address;
    detailsHtml += '"></div></div><div class="row mb-2"><div class="col"><label for="destination-id" class="form-label strong"><strong>Bil-id</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.destination.id;
    detailsHtml += '"></div><div class="col"><label for="destination-name" class="form-label strong"><strong>Hotell</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.destination.hotel;
    detailsHtml += '"></div><div class="col"><label for="destination-model" class="form-label"><strong>Stad</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.destination.city;
    detailsHtml += '"></div></div><div class="row mb-5"><div class="col"><label for="destination-type" class="form-label strong"><strong>Land</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.destination.country;
    detailsHtml += '"></div><div class="col"><label for="destination-price" class="form-label"><strong>Pris/dag</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.destination.dailyPrice;
    detailsHtml += '"></div></div><div class="row mb-4"><div class="col"><label for="booking-start" class="form-label strong"><strong>Startdatum</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.bookingDate.startDate;
    detailsHtml += '"></div><div class="col"><label for="booking-end" class="form-label strong"><strong>Slutdatum</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
    detailsHtml += booking.bookingDate.endDate;
    detailsHtml += '"></div><div class="col"><label for="booking-price" class="form-label"><strong>Totalpris</strong></label><input type="text" class="form-control form-control-sm" placeholder="';
     
    const dates = {
        'startDate': booking.bookingDate.startDate,
        'endDate': booking.bookingDate.endDate
    }
    detailsHtml += calcTotalPrice(calcDaysBetween(dates), booking.destination.dailyPrice);

    detailsHtml += '" disabled></div></div><div class="row"><div class="col d-flex justify-content-start"><input id="back-btn" type="button" class="btn btn-secondary" value="Tillbaka"></div>';

    
    if(isActive){
        detailsHtml += '<div class="col d-flex justify-content-end"><input id="update-btn" type="button" class="btn btn-primary" value="Uppdatera bokning"></div>';
    } else {
        detailsHtml += '<div class="col d-flex justify-content-end"><input id="update-btn" type="button" class="btn btn-primary" value="Uppdatera bokning" disabled></div>';
    }
   
    detailsHtml += '</div></form></div>';

    $('#content').html(detailsHtml);

    // Event för knappen tillbaka
    $('#back-btn').click(myBookingsView);

    // Event för knappen uppdatera
    $('#update-btn').click(updateBooking);
}

async function getDestinations(dates){
    const url = 'http://localhost:8787/api/v2/trips'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + currentUser.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(dates)
    })
    const destinations = response.json();

    return destinations;
}

async function updateBooking(){
    let newBooking = {
        'id': '',
        'bookingDate': {
            'id': '',
            'startDate': '',
            'endDate': ''
        },
        'customer': {
            'id': ''
        },
        'destination': {
            'id': ''
        }
    }

    //Hämta och sätt bookingId
    const bookingIdElem = $('[id=booking-id]')[0].innerHTML;
    
    // Hämtar alla inputs av typen text
    const results = $(':text');

    // Lägger till värden som behövs mot API
    newBooking.id = bookingIdElem.charAt(bookingIdElem.length - 1);
    newBooking.customer.id = (results[0].value == '') ? results[0].placeholder : results[0].value;
    newBooking.destination.id = (results[3].value == '') ? results[3].placeholder : results[3].value;
    newBooking.bookingDate.startDate = (results[8].value == '') ? results[8].placeholder : results[8].value ; 
    newBooking.bookingDate.endDate = (results[9].value == '') ? results[9].placeholder : results[9].value;

    const responseStatus = await putNewBooking(newBooking);

    if(responseStatus === 200){
        $('#content').html('<div class="alert mx-auto text-center mt-4 alert-success" role="alert">Bokningen är uppdaterad!</div>');
    } else {
        $('#content').html('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Det gick inte att uppdatera bokningen!<br>Försök igen</div>');
    }
} 

async function putNewBooking(newBooking){
    const url = 'http://localhost:8787/api/v2/updatetrip';

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: 'Bearer ' + currentUser.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newBooking)
    })
    return response.status;
}

async function getMyBookings(){
    const url = 'http://localhost:8787/api/v2/mytrips';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + currentUser.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({'id': currentUser.id})
    })
    return await response.json();
}
