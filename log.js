function log(message) {
    // create a html container with golem_logs as an ID to have logs printed
    x = new Date();
    t = x.getHours() + ":" + x.getMinutes() + ":" + (x.getSeconds() < 10 ? "0" + x.getSeconds() : x.getSeconds());
    message = t + " " + message;
    // $("#golem_logs").prepend(message+"<br>");
    console.log(message);
}