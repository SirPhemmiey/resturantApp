console.log('one');

setTimeout(function() {
     console.log('two')
     }, 0);

Promise.resolve().then(function() { console.log("three")
});

console.log('four');

//https://trello.com/b/8BvZH5dY