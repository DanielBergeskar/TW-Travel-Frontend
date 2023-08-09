
function newCustomerView(){
    let html = '<div class="container-sm mt-4 shadow p-4"><form id="form"><div class="row mb-2"><div class="col"><label for="customer-id" class="form-label strong"><strong>Kund nr</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '#'
    html += '" disabled></div><div class="col"><label for="customer-name" class="form-label strong"><strong>Namn</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div><div class="col"><label for="customer-address" class="form-label"><strong>Adress</strong></label><input type="text" class="form-control form-control-sm" value="';
    html += '';
    html += '"></div></div><div class="row mb-5"><div class="col"><label for="customer-username" class="form-label strong"><strong>Användarnamn</strong></label><input type="text" class="form-control form-control-sm" value="';
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