var test = "test";
console.log(test);

fetch('/metrics').then(function (response) {
  return response.json();
})
.then(function (body) {
  console.log(body);


  
});