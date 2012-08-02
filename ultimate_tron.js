
var ctx;
var canvas;
var current_game;
var frames = 0;
var round_ms = 0;
var draw_ms = 0;
var calc_ms = 0;

function clone(o) {
	var ret = {};
	ret.__proto__ = o;
	return ret;
}

function merge(o1,o2) {
	for (var key in o2) {
		o1[key] = o2[key];
	}
	return o1;
}

function update(o1,o2) {
	for (var key in o2) {
		if(o1[key] === undefined) {
			o1[key] = o2[key];
		}
	}
	return o1;	
}

function ScoreCard() {
	this.points = 0;
	this.places = [];
	this.kills = [];
	this.deaths = [];
}

var Border = {
	id: 'border',
	scoreCard : new ScoreCard()
};

var player1_slot = {
	posX : 50,
	posY : 50,
	dir : 1, //0-top, 1-right, ..,
	velocity : 1,
	color : '255,0,0',
	color2 : '255,255,0',
	keycode_left: 188, // <
	keycode_right: 89  // x
};

var player2_slot = {
	posX : 350,
	posY : 50,
	dir : 3, //0-top, 1-right, ..,
	velocity : 1,
	color : '255,0,255',
	color2 : '255,255,255',
	keycode_left: 37, // left
	keycode_right: 39 // right
};

var player3_slot = {
	posX : 50,
	posY : 250,
	dir : 1, //0-top, 1-right, ..,
	velocity : 1,
	color : '124,252,0',
	color2 : '72,209,204',
	keycode_left: 27, // esc
	keycode_right: 92 // ^
};

var player4_slot = {
	posX : 350,
	posY : 250,
	dir : 3, //0-top, 1-right, ..,
	velocity : 1,
	color : '255,255,0',
	color2 : '0,100,0',
	keycode_left: 187, // +
	keycode_right: 8 // back
};

var player5_slot = {
	posX : 50,
	posY : 150,
	dir : 1, //0-top, 1-right, ..,
	velocity : 1,
	color : '255,0,0',
	color2 : '205,92,92',
	keycode_left: 66, // b
	keycode_right: 78 // n
};

var player6_slot = {
	posX : 350,
	posY : 150,
	dir : 3, //0-top, 1-right, ..,
	velocity : 1,
	color : '0,0,205',
	color2 : '211,211,211',
	keycode_left: 55, // 7
	keycode_right: 54 // 6
};


function Player(player_slot, id) {
	this.player_slot = player_slot;
	this.left = false;
	this.right = false;
	this.id = id;
	this.scoreCard = new ScoreCard();
	this.next_round = function(game, state) {}
}

var default_ai_params = {
	chance_gradient_margin : 40,
	chance_power_modifier : 1.5,
	random_dir_margin : 150
};

var ai_params2 = { //-10%
	chance_gradient_margin : 10,
	chance_power_modifier : 2.0,
	random_dir_margin : 100
};

var ai_params3 = { //-10%
	chance_gradient_margin : 100,
	chance_power_modifier : 0.5,
	random_dir_margin : 50
};


function AIPlayer(player_slot, id, ai_params) {
	merge(this, new Player(player_slot, id));
	ai_params = update(ai_params || {},default_ai_params);
	this.next_round = function(game, state) {
		var dist_obstacle = calc_obstacle_dist(game.arena,state.posX,state.posY,state.dir);
		var chance_to_turn = 1/(Math.pow(
			Math.min(dist_obstacle,ai_params.chance_gradient_margin),
			ai_params.chance_power_modifier));
		if(Math.random() < chance_to_turn) {
			var dist_obstacle_left = calc_obstacle_dist(game.arena,state.posX,state.posY, (state.dir+3) % 4);
			var dist_obstacle_right = calc_obstacle_dist(game.arena,state.posX,state.posY, (state.dir+1) % 4);
			if(dist_obstacle_right > ai_params.random_dir_margin && dist_obstacle_left > ai_params.random_dir_margin)
				Math.random() %2 ? state.left = true : state.right = true;
			else if(dist_obstacle_left > 1 && dist_obstacle_right <= dist_obstacle_left)
				state.left = true;
			else if(dist_obstacle_right > 1)
				state.right = true;
		}
	}

	function calc_obstacle_dist(arena,x,y,dir) {
		var dist_obstacle = 0;
		var p_zero = [x,y];
		while(true) {

			switch (dir) {
				case 0:
					p_zero = [p_zero[0], p_zero[1] -1];
				break;
				case 1:
					p_zero = [p_zero[0] +1, p_zero[1]];
				break;
				case 2:
					p_zero = [p_zero[0], p_zero[1] +1];
				break;
				case 3:
					p_zero = [p_zero[0] -1, p_zero[1]];
				break;
				
			}
			dist_obstacle ++;
			if(arena[p_zero[0]][p_zero[1]])
				break;

		}
		return dist_obstacle;
	}

}

function init_arena() {
	var arena=new Array(400)
	for(var i =0; i<arena.length; ++i) {
		arena[i] = new Array(300);
		arena[i][0] = {player:Border};
		arena[i][299] = {player:Border};
		if(i == 0 || i == 399) {
			for (var j=0; j<300; ++j) {
				arena[i][j] = {player:Border};
			}
		}
	}
	return arena;
}

var default_game_params = {
	virtual: false,
	tick_interval: 20, //ms
	gameover_callback : function(){},
	player_gameover_callback: function() {}
};

function Game(players, game_params) {
	update(game_params,default_game_params);

	var that = this;
	var arena = init_arena();
	this.arena = arena;
	var living_players;
	var ticker;
	var keystroke_map = {};

	var player_states;

	function move(player_state){
		if(player_state.gameover)
			return;

		if(keystroke_map[player_state.keycode_left])
			player_state.left = true;

		if(keystroke_map[player_state.keycode_right])
			player_state.right = true;
		
		if (player_state.left && !player_state.right) {
				player_state.dir = (player_state.dir+3) % 4;
		}
		else if (player_state.right && !player_state.left) {
			player_state.dir = (player_state.dir+1) % 4;	
		}

		player_state.right = player_state.left = false;

		this.key = new Array();	

		var deltas = get_deltas(player_state);
		
		player_state.posX += deltas[0];
		player_state.posY += deltas[1];
		
		if(arena[player_state.posX][player_state.posY])
			gameover(player_state, arena[player_state.posX][player_state.posY]);
		else {
			arena[player_state.posX][player_state.posY] = player_state;

			player_state.player.next_round(that,player_state);
		}
	}

	function round() {
		var first_t = Date.now();

		player_states.forEach(move);
		keystroke_map = {};

		var second_t = Date.now();
		calc_ms += second_t- first_t;

		if(!game_params.virtual)
			player_states.forEach(draw);
		frames++;
		
		draw_ms += Date.now() - second_t;
		round_ms += Date.now() - first_t;

		if(living_players == 0) {	
			that.destroy();
			return false;
		}
		return true;
	}

	this.init =function() {
		living_players = players.length;
		player_states = [];
		players.forEach(function(player) {
			var state = merge({},player.player_slot);
			state.player = player;
			player_states.push(state);
		});
		if(game_params.virtual) {
			while(round());	
		}
		else {
			clearInterval(ticker);
			canvas = $('canvas').get(0);
			ctx=canvas.getContext("2d");
			ctx.clearRect(0,0, canvas.width, canvas.height);
			draw_arena(arena);
			ticker = setInterval(round, game_params.tick_interval);
		}
	};

	this.destroy = function() {
		clearInterval(ticker);
		game_params.gameover_callback();
	}

	this.to_left = function() {
		player_states[0].left = true;
	} 

	this.to_right = function() {
		player_states[0].right = true;
	} 

	this.register_keystroke = function(keycode) {
		keystroke_map[keycode] = true;
	}


	function gameover(player_state, crashed_into) {
		player_state.gameover = true;
		--living_players;
		
		player_state.player.scoreCard.deaths.push(crashed_into.player);
		player_state.player.games_played++;
		crashed_into.player.scoreCard.kills.push(player_state.player);
		player_state.player.scoreCard.places.push( players.length - living_players );

		game_params.player_gameover_callback(player_state.player,crashed_into.player);
	}
}

function get_deltas(player) {
	switch(player.dir) {
		case 0:
		return [0,-player.velocity];
		case 1:
		return [player.velocity,0];
		case 2:
		return [0,player.velocity];
		case 3: 
		return [-player.velocity,0];
	}	
}



function draw(player){
	if(player.gameover)
		;
	else
		createGlow(player, 0.5);
}


function createGlow(player, a) {
	var r = 4;
	var g = ctx.createRadialGradient(player.posX*2,player.posY*2,0,player.posX*2,player.posY*2,r);
	g.addColorStop(0, 'rgba(' + player.color + ',' + a + ')');
	g.addColorStop(1, 'rgba(' + player.color2 + ',0.0)');
	ctx.fillStyle = g;
	ctx.fillRect(player.posX*2 -r, player.posY*2 -r, r * 2, r * 2);
}

function draw_arena(arena) {
	//ctx.strokeStyle = 'rgb(255,255,255)';
	var lingrad = ctx.createLinearGradient(0,0,0,600);
    lingrad.addColorStop(0, '#00ABEB');
    lingrad.addColorStop(1, '#fff');
    ctx.strokeStyle = lingrad;
	ctx.lineWidth = 4;
    ctx.strokeRect(1,1,798,598);
}




function msg(str,color) {
	$('<p>').text(str).css('color',color).appendTo('#messages');
	$('#messages').stop().animate({
         scrollTop: $("#messages")[0].scrollHeight
     }, 1000);

}

document.onkeydown=function(e){
	console.log(e.keyCode);

	if(e.keyCode == 116) {
		restart();
	}

	if(current_game)
		current_game.register_keystroke(e.keyCode);
}

var players = [
	new Player(player1_slot, 'Matti'),
	new Player(player2_slot, 'Tanja'),
	new AIPlayer(player3_slot, 'Player3'),
	new AIPlayer(player4_slot, 'Player4'),
	new AIPlayer(player5_slot, 'Player5'),
	new AIPlayer(player6_slot, 'Player6')
];

Array.prototype.sum=function() {
	return this.reduce(function(a,i) {return a+i},0);
}

function redraw_scorecard() {
	var table = $('<table>');
	
	var thr = $('<tr><th></th><th>Games</th><th>Points</th><th>Kills</th><th>Deaths</th></tr>')
	table.append(thr);
	players.forEach(function (player) {
		var tr = $('<tr>');
		tr.append('<td>' + player.id + '</td>')
		.append('<td>' + player.scoreCard.places.length + '</td>')
		.append('<td>' + player.scoreCard.places.sum() + '</td>')
		.append('<td>' + player.scoreCard.kills.length + '</td>')
		.append('<td>' + player.scoreCard.deaths.length + '</td>');
		table.append(tr);
	});
	$('#scoreCard').html(table);
}

function player_gameover(player, crashed_into) {
	msg(player.id + ' crashed into ' + crashed_into.id ,'#00FFFF');
	redraw_scorecard();
}

function shuffle(array) {
    var tmp, current, top = array.length;

    if(top) while(--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }

    return array;
}

function restart() {
	redraw_scorecard();
	if(current_game)
		current_game.destroy();
	msg('start', 'red');
	current_game = new Game(players, {gameover_callback: redraw_scorecard, player_gameover_callback: player_gameover});
	current_game.init();
}

function calc_fps() {
	$('#fps').html(frames + '<br>round:' + (round_ms/frames).toFixed(2) + '<br>calc:' + (calc_ms/frames).toFixed(2) + '<br>draw:' + (draw_ms/frames).toFixed(2));
	frames = 0;
	round_ms=0;
	calc_ms=0;
	draw_ms=0;
}

window.onload=function(){
	restart();
	setInterval(calc_fps,1000);
}