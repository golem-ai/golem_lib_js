class GolemCore {
    constructor(host, port) {
        var host = "ws://" + host + ":" + port;
        this.socket = new WebSocket(host);
    }
    
    golem_send(message) {
        message = JSON.stringify(message);
        var len = pad8(byteLength(message));
        //log(socket.golem_type + " : Sending Message(" + len + ") : " + message);
        this.socket.send(len + message);
        this.last_packet_sent = message;
    }
    
    get last_packet_sent() {
        return this.last_packet_sent
    }
}


class GolemFront extends GolemCore {
    constructor(longueurCôté) {
        super(longueurCôté, longueurCôté);
    }
    get aire() {
        return this.hauteur * this.largeur;
    }
    set longueurCôté(nouvelleLongueur) {
        this.hauteur = nouvelleLongueur;
        this.largeur = nouvelleLongueur;
    }
}

/*
**
*/


var last_packet_sent;
var last_answer_received;
var last_call_received;
var last_command;
var last_language;

function create_json_insatisfaction() {
    var json = {
        url: "<" + window.location.href + ">",
        name: golem_project_name,
        websocket_port: websocket_port,
        last_packet_sent: last_packet_sent,
        last_answer_received: last_answer_received,
        last_call_received: last_call_received,
        last_command: last_command,
        last_language: last_language,
        user_agent: navigator.userAgent
    };
    return json;
}

$("#unsatisfied_button").click(function(event) {
    $("#unsatisfied_button").addClass('disabled');
    var data = create_json_insatisfaction();
    var message = '';
    $.each(data, function(index, value) {
        message += index + " : " + value + "\n";
    });
    message += "================================";
    var json = {
        payload: JSON.stringify({
            text: message
        })
    };
    $.post("https://hooks.slack.com/services/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", json, function(data) {
        $.rustaMsgBox({
            fadeOut: false,
            closeButton: true,
            content: "Votre rapport d'erreur a bien été pris en compte. Merci.",
            mode: 'success',
            bottom: '150px',
            fadeTimer: 4000
        });
    });
    return false;
});

function log(message) {
    // create a html container with golem_logs as an ID to have logs printed
    x = new Date();
    t = x.getHours() + ":" + x.getMinutes() + ":" + (x.getSeconds() < 10 ? "0" + x.getSeconds() : x.getSeconds());
    message = t + " " + message;
    // $("#golem_logs").prepend(message+"<br>");
    console.log(message);
}

function golem_work(socket, language, query) {
    var message = {
        type: "request",
        language: language,
        text: query
    };
    last_command = query
    last_language = language
    golem_data_request(message);
    golem_send(socket, message);
}

function pad8(num) {
    var s = "00000000" + num;
    return s.substr(s.length - 8);
}

function byteLength(str) {
    // returns the byte length of an utf8 string
    var s = str.length;
    for (var i = str.length - 1; i >= 0; i--) {
        var code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff) s++;
        else if (code > 0x7ff && code <= 0xffff) s += 2;
        if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
    }
    return s;
}

function golem_send(socket, message) {
    message = JSON.stringify(message);
    var len = pad8(byteLength(message));
    log(socket.golem_type + " : Sending Message(" + len + ") : " + message);
    socket.send(len + message);
    last_packet_sent = message;
}

function golem_connect(host, port, type, context) {
    var host = "ws://" + host + ":" + port;

    socket = new WebSocket(host);

    socket.golem_type = type;

    if (type == 'target')
        socket.onerror = function(evt) {
            $.rustaMsgBox({
                fadeOut: false,
                closeButton: true,
                content: "Impossible de se connecter à " + host,
                mode: 'error',
                bottom: '150px',
                fadeTimer: 4000
            });
        };

    socket.onmessage = function(evt) {
        log(type + " : Received Message: " + evt.data);

        var data = evt.data.substring(8);
        data = JSON.parse(data);

        if (data.type == "call") {
            last_call_received = evt.data;
            golem_data_response(data);
            log("Calling : " + calls[data.id].name + " (id:" + data.id + ", args:" + JSON.stringify(data.params) + ")");
            calls[data.id].call(data.params);
        }
        else if (data.type == "answer") {
            last_answer_received = evt.data;
            golem_data_response(data);
        }
    };
    socket.onclose = function(evt) {
        log(type + " : Connection closed.");
    };
    socket.onopen = function(evt) {
        log(type + " : Connection opened.");

        golem_send(this, {
            type: "identity",
            category: type,
            idsession: context,
            version: golem_project_version,
            revision: golem_project_revision,
            name: golem_project_name + "_" + type
        });

        if (this.golem_type == "target") {
            calls.forEach(function(element, index, array) {
                golem_send(this, {
                    type: "interaction",
                    category: "action",
                    id: index,
                    name: element.golem_name,
                    descriptor: element.golem_descriptor,
                    args: element.golem_args,
                });
            }, this);
        }
        else if (this.golem_type == "front") {
            // Used to run tests, function must be defined in projet file
            golem_tests(this);
        }
    };
    return socket;
}

function golem_init(host, port, context) {
    var socket_target = golem_connect(host, port, "target", context);
    var socket_front = golem_connect(host, port, "front", context);

    return socket_front;
}
