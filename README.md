[![Build Status](https://travis-ci.org/william-silversmith/norm.svg?branch=master)](https://travis-ci.org/william-silversmith/norm)

# norm
A SQL builder that doesn't force its opinions on you. Just pastes SQL together in a constructive manner.

# Installation

Soon coming to npm. For now, simply grab it from github.

# Examples

## Simple Select Example

Supported Clauses: select, distinct, from, where, groupby, having, orderby, limit

    var norm = require('norm');
    
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
	>> 'select users.id, users.username from users where users.powerlevel >= 9000 limit 1'
	>> [ 9000 ]

## Subquery Example

	var norm = require('norm');

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

Supported Operators: and, or, nand, nor

By default, clauses like where and having use the and conjunction as it is the most common filter. However, sometimes you want a more complex query.

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

## Update 

Supported Clauses: update, set, where, orderby, limit

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
			{ name: "World Devastators", date: "A Very Slightly Less Long Time Ago" }
		);

	console.log(values_query_array.sql())
	console.log(values_query_array.binds())

	>> 'insert into superweapons (name, date) values (?,?),(?,?)'
	>> [ 'Death Star', 'A Long Time Ago', 'World Devastators', 'A Very Slightly Less Long Time Ago' ]

	var select_query = norm()
		.insert("superweapons (name)")
		.select("catastrophes.cause")
		.distinct()
		.from("catastrophes")
		.where("catastrophes.destruction_level > 9000");

	console.log(values_query_array.sql())
	console.log(values_query_array.binds())

	>> 'insert into superweapons (name) select catastrophes.cause from catastophes where catastrophes.destruction_level > 9000'
	>> []
	
## Delete

Supported Clauses: delete, using, where, orderby, limit

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
