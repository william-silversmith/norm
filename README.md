[![Build Status](https://travis-ci.org/william-silversmith/norm.svg?branch=master)](https://travis-ci.org/william-silversmith/norm)

# norm
A SQL builder that doesn't force its opinions on you. Just pastes SQL together in a constructive manner.

How will this make your life better? If you've never used a SQL builder:

- SQL objects are composable like functions
- SQL looks much more natural inside of your code
- Binds tracking is handled for you
- Arrays of values are gracefully handled

What's different about norm-sql?

- No setting up copies of schemas in javascript, just start writing SQL
- Expressive logical operators that are simple to use
- Easy to adapt to most SQL engines
- Small module size - no mysteries!
- No production dependencies 
- Supports MySQL/MariaDB/Oracle binds (?) and Postgres prepared statements ($1)

Check out the examples below to get a handle on what this looks like in practice.

# Installation

`npm install norm-sql`

# Examples

## Simple Select Example

Supported Clauses: select, distinct, from, where, groupby, having, orderby, limit

    var norm = require('norm-sql');
    
    var query = norm()
    	.select("users.id", "users.username")
    	.from("users")
    	.where(
			[ "users.powerlevel >= ?", 9000 ],
			"users.created >= NOW() - INTERVAL 1000 YEAR"
    	)
    	.limit(1);

	console.log(query.sql());
	console.log(query.binds());

    Output:
	>> 'select users.id, users.username from users where users.powerlevel >= ? limit 1'
	>> [ 9000 ]

## Subquery Example

	var norm = require('norm-sql');

	var national_query = norm()
		.select("sum(nations.gdp)")
		.from("nations")
		.where(
			"nations.planetid = planets.id",
			"nations.deleted is null"
		);

	var planetary_query = norm()
			.select(
				"planets.id", 
				"planets.name",
				[ "(?) GPP", national_query ]
			)
			.from("planets")
			.where(
				"GPP > 0",
				[ "planets.au < ?", 50 ]
			);

	console.log(planetary_query.sql());
	console.log(planetary_query.binds());

	Output:
	>> 'select planets.id, planets.name, (select sum(nations.gdp) from nations where nations.planetid = planets.id and nations.deleted is null) GPP from planets where GPP > 0 and planets.au < ?'
	>> [ 50 ]

## Constructing Similar Queries

Start with the planetary_query from the last example:

	var real_planetary_query = planetary_query.clone().where("planets.deleted is null");

	console.log(planetary_query.sql());

	Output:
	>> 'select planets.id, planets.name, (select sum(nations.gdp) from nations where nations.planetid = planets.id and nations.deleted is null) GPP from planets where GPP > 0 and planets.amu < ? and planets.deleted is null'

Sorry Pluto....

## Array Binds

Here's a feature that's bizzarely missing in a variety of SQL programming contexts: Array Binds.
	
	var norm = require('norm-sql');

	var query = norm()
		.select(
			"meme.id"
		)
		.from(
			"meme"
		)
		.where(
			["meme.name in (?)", [ 'doge', 'nyan', 'ggg' ]]
		);

	console.log(query.sql());
	console.log(query.binds());

	Output:
	>> 'select meme.id from meme where meme.name in (?,?,?)'
	>> [ 'doge', 'nyan', 'ggg' ]

## Synthesizing Logical Expressions

Supported Operators: and, or, nand, nor, xor

By default, clauses like where and having use the and conjunction as it is the most common filter. However, sometimes you want a more complex query.

	var norm = require('norm-sql');

	var query = norm().select(
			"breakfasts.id",
			"breakfasts.date",
			"breakfasts.type"
		)
		.from("breakfasts")
		.where(
			"breakfasts.date > NOW() - INTERVAL 1 YEAR",
			norm.or(
				[ "breakfasts.type in (?, ?)", 'brunch', 'standard'],
				[ "breakfasts.friend_count > ?", 20 ]
			)
		);

	console.log(query.sql());
	console.log(query.binds());

	Output:
	>> 'select breakfasts.id, breakfasts.date, breakfasts.type from breakfasts where breakfasts.date > NOW() - INTERVAL 1 YEAR and (breakfasts.type in (?, ?) or breakfasts.friend_count > ?)'
	>> [ 'brunch', 'standard', 20 ]

Note: For more than two inputs, xor is defined as one and only one as opposed to nested binary xors as this is probably more useful.

## Update 

Supported Clauses: update, set, where, orderby, limit

	var norm = require('norm-sql');

	var query = norm()
		.update("superheros")
		.set(["superheros.real_first_name = ?", 'bruce'])
		.where(["superheros.id = ?", 1])
		.limit(1);

	console.log(query.sql());
	
	Output:
	>> 'update superheros set superheros.real_first_name = ? where superheros.id = ?'

## Insert 

Supported Clauses: insert, values, select

	var norm = require('norm-sql');

	var values_query_array = norm()
		.insert("superweapons (name)")
		.values(['Death Star'], ['World Devastators']);

	console.log(values_query_array.sql())
	console.log(values_query_array.binds())

	>> 'insert into superweapons (name) values (?),(?)'
	>> [ 'Death Star', 'World Devastators' ]

	var values_query_hashes = norm()
		.insert("superweapons")
		.values(
			{ name: "Death Star", date: "A Long Time Ago" }, 
			{ name: "World Devastators", date: "A Very Slightly Less Long Time Ago" },
			{ 
				name: "Sun Crusher", 
				date: { 
					raw: true, 
					value: "NOW() - INTERVAL 401241 YEAR",
				}, 
			}
		);

	console.log(values_query_array.sql())
	console.log(values_query_array.binds())

	>> 'insert into superweapons (name, date) values (?,?),(?,?),(?,NOW() - INTERVAL 401241 YEAR)'
	>> [ 'Death Star', 'A Long Time Ago', 'World Devastators', 'A Very Slightly Less Long Time Ago', 'Sun Crusher' ]

	var select_query = norm()
		.insert("superweapons (name)")
		.select("catastrophes.cause")
		.distinct()
		.from("catastrophes")
		.where("catastrophes.destruction_level > 9000");

	console.log(values_query_array.sql())
	console.log(values_query_array.binds())

	>> 'insert into superweapons (name) select distinct catastrophes.cause from catastophes where catastrophes.destruction_level > 9000'
	>> []
	
## Delete

Supported Clauses: delete, using, where, orderby, limit

	var norm = require('norm-sql');

	var dml = norm()
		.delete("particles")
		.where(
			["particles.membership = ?", 'atom'],
			["particles.class in (?)", ['electron', 'neutron']]
		);

	console.log(dml.sql());
	console.log(dml.binds());

	Output:
	>> 'delete from particles where particles.membership = ? and particles.class in (?,?)'
	>> [ 'atom', 'electron', 'neutron' ]

Boom.

## Switch DB Engines

	var norm = require('norm-sql');

	norm.engine('postgres'); // default is mysql

	var sql = norm()
		.select("game, finished")
		.from("matches")
		.where(
			[ "game in (?, ?)", 'chess', 'thermonuclear_war' ],
			[ "finished = date '?'", '1983-01-01' ]
		);

	console.log(dml.sql());
	console.log(dml.binds());

	Output:
	> "select game, finished from matches where game in ($1, $2) and finished = date '$3'"
	> [ 'chess', 'themonuclear_war', '1983-01-01' ]

Lesser boom.


