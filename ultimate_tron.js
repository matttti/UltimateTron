
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

function nrand() {
	var x1, x2, rad, y1;

	do {
		x1 = 2 * Math.random() - 1;
		x2 = 2 * Math.random() - 1;
		rad = x1 * x1 + x2 * x2;
	} while(rad >= 1 || rad == 0);

	var c = Math.sqrt(-2 * Math.log(rad) / rad);

	return x1 * c;
};

// starting with slot 0
function calc_startposition(slot, arena_width, arena_height) {
	switch(slot) {
		case 0:
			return [arena_width/5, arena_height/5, 1];  // x,y,dir
		case 1:
			return [arena_width/5*4, arena_height/5, 3];
		case 2:
			return [arena_width/5, arena_height/5*4, 1];
		case 3:
			return [arena_width/5*4, arena_height/5*4, 3];
		case 4:
			return [arena_width/5, arena_height/2, 1];
		case 5:
			return [arena_width/5*4, arena_height/2, 3];
	}
}

function ScoreCard() {
	this.points = 0;
	this.places = [];
	this.kills = [];
	this.deaths = [];
	this.escapes = 0;
}

var Border = {
	id: 'border',
	scoreCard : new ScoreCard()
};

var player1_slot = {
	velocity : 1,
	color : '255,0,0',
	color2 : '255,255,0',
	keycode_left: 188, // <
	keycode_right: 89  // x
};

var player2_slot = {
	velocity : 1,
	color : '255,0,255',
	color2 : '255,255,255',
	keycode_left: 37, // left
	keycode_right: 39 // right
};

var player3_slot = {
	velocity : 1,
	color : '124,252,0',
	color2 : '72,209,204',
	keycode_left: 27, // esc
	keycode_right: 92 // ^
};

var player4_slot = {
	velocity : 1,
	color : '255,255,0',
	color2 : '0,100,0',
	keycode_left: 187, // +
	keycode_right: 8 // back
};

var player5_slot = {
	velocity : 1,
	color : '255,0,0',
	color2 : '205,92,92',
	keycode_left: 66, // b
	keycode_right: 78 // n
};

var player6_slot = {
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
		//var p_zero = [x,y];
		while(true) {

			switch (dir) {
				case 0:
					--y;
				break;
				case 1:
					++x;
				break;
				case 2:
					++y;
				break;
				case 3:
					--x;
				break;
				
			}
			dist_obstacle ++;
			if(is_out_of_bounds(x,y,arena.length, arena[0].length) || arena[x][y])
				break;

		}
		return dist_obstacle;
	}
}


function is_out_of_bounds(x,y,width,height) {
	return x < 0 || x >= width || y < 0 || y >= height;
}

function init_arena(width,height) {
	var arena=new Array(width);
	for(var i =0; i<width; ++i) {
		arena[i] = new Array(height);
		arena[i][0] = {player:Border};
		arena[i][height-1] = {player:Border};
	}
	for (var j=0; j<height; ++j) {
		arena[0][j] = {player:Border};
		arena[width-1][j] = {player:Border};
	}
	return arena;
}

var default_game_params = {
	arena_width: 400,
	arena_height : 300,
	virtual: false,
	fps: 50,
	gameover_callback : function(){},
	player_gameover_callback: function() {},
	player_escapes_callback: function() {},
	splinter_rounds : 60,
	splinter_count : 30
};

function Game(players, game_params) {
	update(game_params,default_game_params);

	var that = this;
	var arena = init_arena(game_params.arena_width, game_params.arena_height);
	this.arena = arena;
	var living_players;
	var ticker;
	var keystroke_map = {};
	var remaining_rounds = Infinity;

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

		if(is_out_of_bounds(player_state.posX,player_state.posY, game_params.arena_width, game_params.arena_height)) {
			escape(player_state);
		}
		else if(arena[player_state.posX][player_state.posY]) {
			gameover(player_state, arena[player_state.posX][player_state.posY]);
		}
		else {
			arena[player_state.posX][player_state.posY] = player_state;
			player_state.player.next_round(that,player_state);
		}
	}

	function move_splinters(player_state) {
		if(!player_state.gameover || !player_state.splinter_rounds_left)
			return;

		player_state.splinters.forEach(function(splinter) {
			splinter.old_posX = splinter.posX;
			splinter.old_posY = splinter.posY;
			splinter.posX = Math.floor(Math.sin(splinter.angle) * splinter.dist_from_origin) + splinter.originX;
			splinter.posY = Math.floor(-Math.cos(splinter.angle) * splinter.dist_from_origin) + splinter.originY;
			splinter.dist_from_origin += splinter.speed;
			splinter.speed -= 1/game_params.splinter_rounds;

			if(!is_out_of_bounds(splinter.old_posX,splinter.old_posY, game_params.arena_width, game_params.arena_height))
				arena[splinter.old_posX][splinter.old_posY] = undefined;
		});

		player_state.splinter_rounds_left--;
	}


	function round() {
		var first_t = Date.now();

		player_states.forEach(move);
		keystroke_map = {};

		player_states.forEach(move_splinters);

		var second_t = Date.now();
		calc_ms += second_t- first_t;

		if(!game_params.virtual)
			player_states.forEach(draw);
		frames++;
		
		draw_ms += Date.now() - second_t;
		round_ms += Date.now() - first_t;

		remaining_rounds --;

		if(!remaining_rounds) {	
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
			canvas = $('canvas').get(0);
			ctx=canvas.getContext("2d");
			ctx.clearRect(0,0, canvas.width, canvas.height);
			draw_arena(arena);
			//this.run();
		}
	};

	this.destroy = function() {
		this.stop();
		game_params.gameover_callback();
	}

	this.stop = function() {
		clearInterval(ticker);
	}

	this.run = function() {
		this.stop();
		ticker = setInterval(round, 1000/game_params.fps);
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

		create_splinters(player_state);

		game_params.player_gameover_callback(player_state.player,crashed_into.player);
	}

	function escape(player_state) {
		player_state.gameover = true;
		--living_players;

		player_state.player.games_played++;
		player_state.player.scoreCard.escapes++;
		player_state.player.scoreCard.places.push( players.length);

		if(!living_players)
			remaining_rounds = game_params.splinter_rounds;

		game_params.player_escapes_callback(player_state.player);

	}

	function create_splinters(player_state) {
		player_state.splinter_rounds_left = game_params.splinter_rounds;
		player_state.splinters = [];
		for (var i=0; i<= game_params.splinter_count; ++i) {
			var splinter = {
				speed : 1,
				originX : player_state.posX,
				originY : player_state.posY,
				posX: player_state.posX,
				posY: player_state.posY,
				angle : ((nrand() /1.4 + player_state.dir) % 4) / 4 * 2*Math.PI,
				dist_from_origin : 0,
				speed : 1
			}
			player_state.splinters.push(splinter);
		}

	}

}

function get_deltas(player_state) {
	switch(player_state.dir) {
		case 0:
		return [0,-player_state.velocity];
		case 1:
		return [player_state.velocity,0];
		case 2:
		return [0,player_state.velocity];
		case 3: 
		return [-player_state.velocity,0];
	}	
}



function draw(player_state){
	var radius = 2;
	var a = 0.5;

	if(!player_state.gameover)
		createGlow(player_state, 0.5);
	else if (player_state.splinter_rounds_left) {
		

		player_state.splinters.forEach(function(splinter) {
			// ctx.beginPath();
			// ctx.clearRect(splinter.old_posX*2 - radius, splinter.old_posY*2 - radius - 1, radius * 2 + 1, radius * 2 + 1);
			// ctx.closePath();

			ctx.fillStyle='rgb(0,0,0)';
			ctx.beginPath();
			ctx.arc(splinter.old_posX*2, splinter.old_posY*2,radius,0,Math.PI*2);
			ctx.closePath();
			ctx.fill();

			if(player_state.splinter_rounds_left > 1) {

				var g = ctx.createRadialGradient(splinter.posX*2,splinter.posY*2,0,splinter.posX*2,splinter.posY*2,radius);
				//g.addColorStop(0, 'rgba(' + player_state.color + ',' + a + ')');
				//g.addColorStop(1, 'rgba(' + player_state.color2 + ',0.0)');
				//ctx.fillStyle=g;
				ctx.fillStyle='rgba(' + player_state.color+',' + splinter.speed +')';
				ctx.beginPath();
				ctx.arc(splinter.posX*2, splinter.posY*2,radius,0,Math.PI*2);
				ctx.closePath();
				ctx.fill();
			}

		});
	}
}


function createGlow(player_state, a) {
	var r = 4;
	var g = ctx.createRadialGradient(player_state.posX*2,player_state.posY*2,0,player_state.posX*2,player_state.posY*2,r);
	g.addColorStop(0, 'rgba(' + player_state.color + ',' + a + ')');
	g.addColorStop(1, 'rgba(' + player_state.color2 + ',0.0)');
	ctx.fillStyle = g;
	ctx.fillRect(player_state.posX*2 -r, player_state.posY*2 -r, r * 2, r * 2);
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
	if(e.keyCode == 117) {
		$('body').toggleClass('shadow');
	}

	if(current_game)
		current_game.register_keystroke(e.keyCode);
}

var players = [
	new Player(player1_slot, 'Matti'),
	new Player(player2_slot, 'Player2'),
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
	
	var thr = $('<tr><th></th><th>Games</th><th>Points</th><th>Kills</th><th>Esacpes</th></tr>')
	table.append(thr);
	players.forEach(function (player) {
		var tr = $('<tr>');
		tr.append('<td>' + player.id + '</td>')
		.append('<td>' + player.scoreCard.places.length + '</td>')
		.append('<td>' + player.scoreCard.places.sum() + '</td>')
		.append('<td>' + player.scoreCard.kills.length + '</td>')
		.append('<td>' + player.scoreCard.escapes + '</td>');
		table.append(tr);
	});
	$('#scoreCard').html(table);
}

function player_gameover(player, crashed_into) {
	msg(player.id + ' crashed into ' + crashed_into.id ,'#00FFFF');
	redraw_scorecard();
}

function player_escapes(player) {
	msg(player.id + ' escapes' ,'#00FFFF');
	redraw_scorecard();
}

function restart() {
	redraw_scorecard();
	if(current_game)
		current_game.destroy();
	msg('start', 'red');

	var game_players = shuffle(players);

	for(var i = 0; i< game_players.length; ++i) {
		var start_position = calc_startposition(i, default_game_params.arena_width, default_game_params.arena_height);
		merge(game_players[i].player_slot, {
			posX: start_position[0],
			posY: start_position[1],
			dir:  start_position[2]});
	}

	current_game = new Game(game_players, {gameover_callback: redraw_scorecard, player_gameover_callback: player_gameover, player_escapes_callback: player_escapes});
	current_game.init();

	show_lineup(game_players, function() {
		current_game.run()
	});

}

var lineup_countdown1;
var lineup_countdown2;
function show_lineup(players, init_game_callback) {
	var gamearea_width = $('#gamearea').width();

	clearTimeout(lineup_countdown1);
	clearTimeout(lineup_countdown2);

	$('.lineup-marker').remove();

	players.forEach(function(player) {
		var marker = $('<span>').addClass('lineup-marker').text(player.id);
		marker.css('top', player.player_slot.posY*2 - 50 + 'px');

		if(player.player_slot.dir == 1)
			marker.css('left', player.player_slot.posX*2 + 'px');
		else
			marker.css('right', gamearea_width-player.player_slot.posX*2 + 'px');

		marker.css('color', 'rgb(' + player.player_slot.color + ')');
		$('#gamearea').append(marker);
	});

	lineup_countdown1 = setTimeout(function() {
		$('.lineup-marker').fadeOut('slow');
		init_game_callback();
	}, 2000);

	//lineup_countdown2 = setTimeout(init_game_callback, 2000);

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