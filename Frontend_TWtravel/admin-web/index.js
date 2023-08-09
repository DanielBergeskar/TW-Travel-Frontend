let keycloak = new Keycloak({url: 'http://localhost:8080', realm: 'TravelAgencyRealm', clientId: 'TravelAgency'});

let adminInfo = {
    'token' : '',
    'role': ''
}

let customers = {};
let destinations = {};

function initKeycloak(){
    keycloak.init({ onLoad: 'login-required' })
    .then(loadAdminInfo);
    
    return keycloak;
}

const loadAdminInfo = () => {
    if (keycloak.idToken) {
        adminInfo.role = keycloak.tokenParsed.realm_access.roles[4];
        adminInfo.token = keycloak.token;

        console.log("Role", adminInfo.role);
        console.log("Token", adminInfo.token);

    } else {
        keycloak.loadUserProfile(function() {
            console.log('Account Service');
            console.log(keycloak.profile.username);
        }, function() {
            console.log('Failed to retrieve user details.');
        });
    }
};

$(function () {

    $('#content').html('<img src="pictures/destinations.png" class="img-fluid"  alt="picture of destinations">');

    $('#all-customers').click(async () =>{ 
        customers = await getAllCustomers();
        customerSortingView();
        allCustomersView();    
    });

    $('#our-destinations').click(async() =>{ 
        destinations = await getAllDestinations();

        destinationSortingView();
        allDestinationsView(); 
    });

    $('#new-destination').click(() =>{ 
        newDestinationView();
    });
    $('#new-customer').click(() =>{ 
        newCustomerView();
    });
});

/*VIEW*/

function homeView(){
    $('#content').html('<img src="pictures/destinations.png" class="img-fluid"  alt="picture of destinations">');
}

function allCustomersView() {

    $('#customers-table').remove();

    let html = '<div id="customers-table" class="table-responsive shadow"><table class="table table-sm table-striped table-hover m-auto"><thead><tr><th scope="col">Förnamn</th><th scope="col">Efternamn</th><th scope="col">Bokningar</th></tr></thead><tbody>';

    customers.forEach(customer => {
        const nameArray = customer.name.split(' ');

        html += '<tr><td>';
        html += nameArray[0];
        html += '</td><td>';
        html += nameArray[1];
        html += '</td><td>';
        html += customer.bookings.length
        html += '</td></tr>';

    });
    html += '</tbody></table></div>';
    
    $('#content').append(html);
}

function customerSortingView() {
    
    let html = '<div class="mt-4 mb-2 col d-flex justify-content-end"><select id="customer-sort" class="form-select form-select-sm w-auto"><option selected disabled>Sortering</option><option>Förnamn</option><option>Efternamn</option><option>Antal bokningar</option></select></div>';

    $('#content').html(html);

    $('#customer-sort').change(function (e) { 
        const value = $('#customer-sort').val();

        switch(value) {
            case 'Förnamn':
                sortByFirstname(customers);
                allCustomersView();
            break;

            case 'Efternamn': 
                sortByLastname(customers);
                allCustomersView();
            break;

            case 'Antal bokningar':
                sortByBookings(customers);
                allCustomersView();
            break;
        }
    });
}

function destinationSortingView(){

    $('#destination-sort-div').remove();

    let html = '<div id="destination-sort-div" class="mt-4 mb-2 col d-flex justify-content-end"><select id="destination-sort" class="form-select form-select-sm w-auto"><option selected disabled>Sortering</option><option>Hotell</option><option>Stad</option><option>Land</option><option>Pris/dag</option></select></div>';

    $('#content').html(html);      

    $('#destination-sort').change(function (e) { 
        const value = $('#destination-sort').val();

        switch(value) {
            case 'Hotell':
                sortDestinationsByHotel();
                allDestinationsView();
            break;

            case 'Stad': 
                sortDestinationsByCity();
                allDestinationsView();
            break;
            case 'Land': 
                sortDestinationsByCountry();
                allDestinationsView();
            break;

            case 'Pris/dag':
                sortDestinationsByDailyPrice();
                allDestinationsView();
            break;
        }
    });

}

function allDestinationsView(){

    $('#destinations-table').remove();

    let html = '<div id="destinations-table" class="table-responsive shadow"><table class="table table-sm table-striped table-hover m-auto"><thead><tr><th>Hotell</th><th>Stad</th><th>Land</th><th>Pris/dag</th><th></th><th></th></tr></thead><tbody>';

    destinations.forEach(destination => {
        html += '<tr><td>';
        html += destination.hotel;
        html += '</td><td>';
        html += destination.city
        html += '</td><td>';
        html += destination.country;
        html += '</td><td>';
        html += destination.dailyPrice;
        html += '</td>';
        html += '<td><button type="button" class="edit-btn btn btn-primary btn-sm text-nowrap">Ändra</button></td>';
        html += '<td><button type="button" class="delete-btn btn btn-danger btn-sm text-nowrap">Ta bort</button></td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';

    $('#content').append(html);

    $('.edit-btn').click(function (e) { 
        const targetDestination = findTargetDestinationFromTable(e);
        editDestinationView(targetDestination);
    });
    
    $('.delete-btn').click(async function (e) { 
        const targetDestination = findTargetDestinationFromTable(e);

        let text = "Vill du ta bort " + targetDestination.hotel + ' ' + targetDestination.city + '?';
        if (confirm(text) == true) {
            
           
            const bookings = await getBookingsByDestination(targetDestination);
            
            
            const newDestinations = await findNewDestinations(bookings, targetDestination);

            
            if(newDestinations.length === bookings.length){
                const updatedBookings = await updateBookingsWithNewDestination(bookings, newDestinations);

                
                const responseStatus = await deleteDestination(targetDestination);
                
                if(responseStatus == 200){
                    $('#content').append('<div class="alert mx-auto text-center mt-4 alert-success" role="alert">Resan är borttagen. Berörda (' + updatedBookings + ') har fått ersättningsresor.</div>');
                    destinations = await getAllDestinations();
                    allDestinationsView();

                } else {
                    $('#content').append('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Det gick inte att ta bort resan.</div>');
                    destinations = await getAllDestinations();
                    allDestinationsView();
                }

            } else { 
                $('#content').append('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Ingen ersättningsresa kan erbjudas!</div>');
                destinations = await getAllDestinations();
                allDestinationsView();
            }
        }
    });
}

function editDestinationView(destination){

    let html = '<div class="container-sm mt-4 shadow p-4"><form id="form"><div class="row mb-2"><div class="col"><label for="destination-id" class="form-label strong"><strong>Destination-id</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += destination.id;
    html += '" disabled></div><div class="col"><label for="destination-hotel" class="form-label strong"><strong>Hotell</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += destination.hotel;
    html += '"></div><div class="col"><label for="destination-city" class="form-label"><strong>Stad</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += destination.city;
    html += '"></div></div><div class="row mb-5"><div class="col"><label for="destination-type" class="form-label strong"><strong>Land</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += destination.country;
    html += '"></div><div class="col"><label for="destination-price" class="form-label"><strong>Pris/dag</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += destination.dailyPrice;
    html += '"></div></div>';
    html += '<div class="row"><div class="col d-flex justify-content-start"><input id="back-btn" type="button" class="btn btn-secondary" value="Tillbaka"></div>'
    html += '<div class="col d-flex justify-content-end"><input id="update-btn" type="button" class="btn btn-primary" value="Uppdatera"></div></div>';
    html += '</form></div>';

    $('#content').html(html);

    $('#back-btn').click(function (e) { 
        destinationSortingView();
        allDestinationsView();
    });

    $('#update-btn').click(async function (e) { 

        const destinationValues = $(':text');
        
        updDestination = {
            'id': destination.id,
            'hotel': destinationValues[1].value,
            'city': destinationValues[2].value,
            'country': destinationValues[3].value,
            'dailyPrice': destinationValues[4].value
        }

        const responseStatus = await updateDestination(updDestination);

        if(responseStatus == 200){
            $('#content').append('<div class="alert mx-auto text-center mt-4 alert-success" role="alert">Resan är uppdaterad!</div>');
            destinations = await getAllDestinations();
        } else {
            $('#content').append('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Det gick inte att uppdatera resan<br>Försök igen</div>');
            $('#update-btn').prop('disabled', 'disabled');
        }
    });
}

function newDestinationView(){
    let html = '<div class="container-sm mt-4 shadow p-4"><form id="form"><div class="row mb-2"><div class="col-3"><label for="destination-id" class="form-label strong"><strong>Destinations-id</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '#'
    html += '" disabled></div><div class="col"><label for="destination-hotel" class="form-label strong"><strong>Hotell</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div><div class="col"><label for="destination-city" class="form-label"><strong>Stad</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div></div><div class="row mb-5"><div class="col"><label for="destination-country" class="form-label strong"><strong>Land</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div><div class="col"><label for="destination-price" class="form-label"><strong>Pris/dag</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div></div>';
    html += '<div class="row"><div class="col d-flex justify-content-start"><input id="add-btn" type="button" class="btn btn-primary" value="Lägg till"></div>'
    html += '<div class="col d-flex justify-content-end"><input id="back-btn" type="button" class="btn btn-danger" value="Avbryt"></div></div>';
    html += '</form></div>';

    $('#content').html(html);

    $('#back-btn').click(async function (e) { 
        homeView();
    });

    $('#add-btn').click(async function (e) { 

        const destinationValues = $(':text');
        
        newDestination = {
            'hotel': destinationValues[1].value,
            'city': destinationValues[2].value,
            'country': destinationValues[3].value,
            'dailyPrice': destinationValues[4].value
        }

        const responseStatus = await addNewDestination(newDestination);

        if(responseStatus == 201){
            $('#content').prepend('<div class="alert mx-auto text-center mt-4 alert-success" role="alert">Resmål har lagts till!</div>');
            $('#update-btn').prop('disabled', 'disabled');
            destinations = await getAllDestinations();
        } else {
            $('#content').prepend('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Ett fel inträffade<br>Försök igen</div>');
            $('#update-btn').prop('disabled', 'disabled');
        }
    });
}
function newCustomerView(){
    let html = '<div class="container-sm mt-4 shadow p-4"><form id="form"><div class="row mb-2"><div class="col-2"><label for="customer-id" class="form-label strong"><strong>Kund nr</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '#'
    html += '" disabled></div><div class="col"><label for="customer-name" class="form-label strong"><strong>Namn</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div><div class="col"><label for="customer-address" class="form-label"><strong>Adress</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div></div><div class="row mb-5"><div class="col-3"><label for="customer-username" class="form-label strong"><strong>Användarnamn</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div></div>';
    html += '<div class="row"><div class="col d-flex justify-content-start"><input id="add-btn" type="button" class="btn btn-primary" value="Lägg till"></div>'
    html += '<div class="col d-flex justify-content-end"><input id="back-btn" type="button" class="btn btn-danger" value="Avbryt"></div></div>';
    html += '</form></div>';

    $('#content').html(html);

    $('#back-btn').click(async function (e) { 
        homeView();
    });

    $('#add-btn').click(async function (e) { 

        const customerValues = $(':text');
        
        newCustomer = {
            'name': customerValues[1].value,
            'address': customerValues[2].value,
            'username': customerValues[3].value,
        }

        const responseStatus = await addNewCustomer(newCustomer);

        if(responseStatus == 201){
            $('#content').prepend('<div class="alert mx-auto text-center mt-4 alert-success" role="alert">Ny kund har lagts till!</div>');
            $('#update-btn').prop('disabled', 'disabled');
            customers = await getAllCustomers();
        } else {
            $('#content').prepend('<div class="alert mx-auto text-center mt-4 alert-danger" role="alert">Ett fel inträffade<br>Försök igen</div>');
            $('#update-btn').prop('disabled', 'disabled');
        }
    });
}
/*FIND*/

function findTargetDestinationFromTable(e){
   
    const rowArray = $(e.target).parent().parent().children();

    let destinationValues = [];

    
    for (let i = 0; i < rowArray.length - 2; i++) {
        destinationValues.push(rowArray[i].innerHTML);
    }

    let targetDestination = {}; 
    
    destinations.forEach((destination) => {
        if(destination.hotel == destinationValues[0] && destination.city == destinationValues[1]){
            targetDestination = destination;
        }    
    });

    return targetDestination;
}

async function findNewDestinations(bookings, targetDestination){

    let newDestinations = [];
    
    for(let booking of bookings){
        const startDate = booking.bookingDate.startDate;
        const endDate = booking.bookingDate.endDate;

        const availableDestinations = await getAvailableDestinations(startDate, endDate);

        let sameTypeDestinations = availableDestinations.filter(destination => destination.country === targetDestination.country);

        newDestinations.push(sameTypeDestinations[0]);

    }
    return newDestinations;
}

async function updateBookingsWithNewDestination(bookings, newDestinations){
    let updatedBookings = 0;

   for(let i = 0; i < bookings.length; i++){
        bookings[i].destination = newDestinations[i];
        updatedBookings += await updateBooking(bookings[i]);
   }

   return updatedBookings;
}

/*SORT*/
function sortByFirstname(customers){

   
    customers.sort((c1, c2) => {
        fn1 = c1.name.split(' ')[0].toLowerCase();
        fn2 = c2.name.split(' ')[0].toLowerCase();
        
        if(fn1 < fn2){
            return -1;
        }
        if(fn1 > fn2){
            return 1;
        }
        return 0;
    });
}

function sortByLastname(customers){
    customers.sort((c1, c2) => {
        
       
        ln1 = c1.name.split(' ')[1].toLowerCase();
        ln2 = c2.name.split(' ')[1].toLowerCase();
        
        if(ln1 < ln2){
            return -1;
        }
        if(ln1 > ln2){
            return 1;
        }
        return 0;
    });
}

function sortByBookings(customers){
    customers.sort((c1, c2) => {
        return c2.bookings.length - c1.bookings.length;
    });
}

function sortDestinationsByHotel(){
    destinations.sort((c1, c2) => {
        
        if(c1.name < c2.hotel){
            return -1;
        }
        if(c1.name > c2.hotel){
            return 1;
        }
        return 0;
    });
}

function sortdestinationsByCity(){
    destinations.sort((c1, c2) => {
        
        if(c1.type < c2.city){
            return -1;
        }
        if(c1.type > c2.city){
            return 1;
        }
        return 0;
    });
}

function sortdestinationsByDailyPrice(){
    destinations.sort((destination1, destination2) => {
        return destination1.dailyPrice - destination2.dailyPrice;
    });
}


/*API*/
async function getAllCustomers(){

    console.log("Role", adminInfo.role);
    console.log("Token", adminInfo.token);

    const url = 'http://localhost:8787/api/v2/customers';

    const response = await fetch(url,{
      
        method: 'GET',
        headers: {
            
            Authorization: 'Bearer' + adminInfo.token,
            
            'Content-Type': 'application/json',
           
        },
    })
    
    return response.json(); 
}

async function getAllDestinations(){
    const url = 'http://localhost:8787/api/v2/alldestinations';

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
    });

    return response.json();
}

async function updateDestination(updDestination){

    const url = 'http://localhost:8787/api/v2/updatedestination'

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(updDestination)
    });

    return response.status;
}

async function getBookingsByDestination(destination){
    const url = 'http://localhost:8787/api/v2/bookingsbydestination'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(destination)
    });

    return response.json();
}

async function getAvailableDestinations(startDate, endDate){
    const url = 'http://localhost:8787/api/v2/destinations';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            'startDate': startDate,
            'endDate': endDate
        }),
    });

    return response.json();
}

async function updateBooking(booking){
    const url = 'http://localhost:8787/api/v2/updatebooking';

    const response = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(booking)
    })

    if(response.status === 200){
        return 1;
    }

}
async function deleteDestination(destination){
    const url = 'http://localhost:8787/api/v2/deletedestination'

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(destination)
    });

    return response.status;
}

async function addNewDestination(destination){
    const url = 'http://localhost:8787/api/v2/adddestination'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(destination)
    });

    return response.status;
}
async function addNewCustomer(customer){
    const url = 'http://localhost:8787/api/v2/addcustomer'

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + adminInfo.token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(customer)
    });

    return response.status;
}
