# norm
A SQL builder that doesn't force its opinions on you. Just pastes SQL together in a constructive manner.

It currently only supports select queries. (SQL) Update, insert, and delete are coming. (DML) 

# Installation

Soon coming to npm. For now, simply grab it from github.

# Examples

## Simple Example

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
	>> 'select planets.id, planets.name, (select sum(nations.gdp) from nations where nations.planetid = planets.id and nations.deleted is null) GPP from planets where GPP > 0 and planets.amu < ?'
	>> [ 50 ]

## Constructing Similar Queries

Start with the planetary_query from the last example:

	var real_planetary_query = planetary_query.clone().where("planets.deleted is null");

	console.log(planetary_query.sql());

	Output:
	>> 'select planets.id, planets.name, (select sum(nations.gdp) from nations where nations.planetid = planets.id and nations.deleted is null) GPP from planets where GPP > 0 and planets.amu < ? and planets.deleted is null'

Sorry Pluto....





