const API_URL = "http://127.0.0.1:5000";


async function getFoods(){

    try{

        let response = await fetch(
            `${API_URL}/api/foods`
        );

        let foods = await response.json();

        return foods;

    }
    catch(error){

        console.log(
            "API Error:",
            error
        );

    }

}