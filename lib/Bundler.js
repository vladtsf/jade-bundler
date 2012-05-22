module.exports = (function() {
	var 
		async = require('async'),
		util = require('util'),
		path = require('path'),
		jade = require('jade'),
		fs = require('fs');

	var 
		jsp = require("uglify-js").parser,
		pro = require("uglify-js").uglify;

	var Bundler = function(app, templates) {
		if(!(this instanceof Bundler)) {
			return new Bundler(app, templates);
		}

		var
			flow = [],
			prefix = app.conf.p,
			bundled = [],
			bundledString = '';

		// read and save
		templates.forEach(function(template, i) {
			flow.push(function(callback) {
				try {
					var file = fs.realpathSync(path.normalize(prefix + template));

					if(app.conf.out && app.conf.v) {
						app.log('add template ' + template + ' to assembly');
					}

					fs.readFile(file, 'utf8', function(err, data) {
						bundled.push('"' + template + '"	: ' + jade.compile(data, {
							client			: true,
							filename			: template,
							compileDebug	: app.conf.debug
						}).toString());
						callback();
					});
				} catch(e) {
					app.error('template ' + template + ' not exists');
				}
			}.bind(this))
		}.bind(this));

		// implode
		flow.push(function(callback) {
			if(app.conf.out && app.conf.v) {
				app.log('build assembly file');
			}

			bundledString += '(function(undefined) {\n\t';
			bundledString += app.conf.object + ' = {\n';
			bundledString += '\t\t' + bundled.join(',\n\t\t') + '\n';
			bundledString += '\t};\n';
			bundledString += '})();';

			callback();
		}.bind(this));

		// uglify
		flow.push(function(callback) {
			if(app.conf.uglify) {
				if(app.conf.out && app.conf.v) {
					app.log('minify assembly file');
				}

				bundledString = Bundler.uglify(bundledString);
			}

			callback();
		}.bind(this));

		// output
		flow.push(function(callback) {
			if(!app.conf.out) {
				util.print(bundledString);
			} else {
				if(app.conf.v) {
					app.log('writing to ' + app.conf.out);
				}

				fs.writeFile(app.conf.out, bundledString, 'utf8', callback);
			}
		});

		async.waterfall(flow);
	};

	Bundler.exprs = {
		newlines		: /(\r\n|\n|\r)/gm,
		quotes			: /"/g,
		escapedQuotes	: /\\"/g
	};


	Bundler.uglify = function(code) {
		var ast = jsp.parse(code); // parse code and get the initial AST
		ast = pro.ast_mangle(ast); // get a new AST with mangled names
		ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
		
		return pro.gen_code(ast);
	};

	Bundler.escape = function(tpl) {
		return tpl ? tpl
					.replace(Bundler.exprs.newlines, '\\n')
					.replace(Bundler.exprs.escapedQuotes, '\\\\"')
					.replace(Bundler.exprs.quotes, '\\"') : '';
	};

	return Bundler;

})();