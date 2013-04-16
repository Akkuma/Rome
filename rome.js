// Rome 0.5.1
// ==========
// "Opinions are good, only when I agree with them." This is Rome's entire philosophy to development.

// If you want to actually work on Rome here are some things you should keep in mind.

// - If it could be done differently it should be exposed to others
// - Rome should make as few assumptions as possible, but still build a good OOBE
// - Smaller, sleeker code is better, but don't completely sacrifice performance
// - Functional programming is highly approved, but keep the previous point in mind
// - Rome should have no dependencies, if possible, unless the library is small enough one could embed or it is so popular it is a "standard"

(function () {
	var self = this,
		jQueryCompat = self.jQuery || self.Zepto,
		body,	
		// Currently even IE8 supports our use of querySelectorAll, so we'll use this internally instead
		$ = function (selector, context) { 
			var nodeList = (context || body || (body = document.body)).querySelectorAll(selector); 
			
			// Convert NodeList to a real array to make operations easier.
			// Based on http://jsperf.com/nodelist-to-array/24 - Terse While new Array
			var len = nodeList.length,
			    arr = new Array(len);
			while (len--) {
			  arr[len] = nodeList[len]
			}

			return arr;
		};

	function nope() { }

	function Rome() { }

	//Potential for supporting multiple registries within Rome?
	function Registry() {
		this.componentsLookup = {};
		/*
		this.components = [];
		this.instances = {};
		*/
	}

	// `NodeList.forEach` doesn't work, so might as well make our own more efficient forEach
	function each(arr, cb) {
		for (var i = 0, len = arr.length; i < len; ++i) {
			cb(arr[i]);
		}
	}

	function eachReverse(arr, cb) {
		for (var i = arr.length - 1; i >= 0; --i) {
			cb(arr[i]);
		}
	}

	// Should be a reference to the window object for now
	Registry.prototype = {
		// Used during `Rome.erect` to get the planned component
		findComponent: function (name) {
			return this.componentsLookup[name];
		},
		addComponent: function (base, component, mixins) {
			var name = component._rome.name;
			if (this.componentsLookup[name]) return;

			//this.components.push(component);
			this.componentsLookup[name] = { base: base, mixins: mixins };
		},
		//@TODO: Change to store on the actual element rather than in memory?
		findInstance: function (root) {
			return root._rome //|| this.instances[root];
		},
		addInstance: function (root, componentName, instance) {
			//@TODO: Determine whether or not we need to maintain a list of instances 
			//or if living on the root element is good enough
			//this.instances[componentName] || (this.instances[componentName] = [])
			//this.instances[componentName].push(instance);
			root._rome = { component: instance };
		}
	};

	var reg = Rome.Registry = new Registry();

	function getInstance(obj) {
		var romeData = obj._rome;
		return romeData.mixins ? obj : romeData.component;
	}

	//@TODO add setter to manipulate $ if set later defineProperty
	//var $ = Rome.$ = self.jQuery || self.Zepto || self.$;

	// Strategies are a minimal abstraction/transformation layer
	// that will allow users to replace the OOBE of Rome.
	var strats = Rome.Strategies = {
		mixin: function (obj, mixin) {
			mixin(obj);
		},

		// These are mixins that get added to all components
		autoMixins: [],

		// Handles all DOM changes as to automatically wire-up and destroy components
		domObserver: function () {
			function erect(node) {
				node = node.target || node;

				var romeComponentName = node.getAttribute && node.getAttribute('data-rome');
				!node._rome && romeComponentName && erectInstances($('[data-rome]', node).concat(node))
			}

			function destroy(node) {
				var domRomeData = (node.target || node)._rome;
				domRomeData && domRomeData.component.destroy({ domObserved: true })
			}

			var MutationObserver = self.MutationObserver || self.WebKitMutationObserver;
			if (MutationObserver) {
				var observer = new MutationObserver(function (mutations) {
					eachReverse(mutations, function (mutation) {
						eachReverse(mutation.addedNodes, erect);
						eachReverse(mutation.removedNodes, destroy);
					});
				});

				observer.observe(document.body, { subtree: true, childList: true });
			}
			else {
				document.body.addEventListener('DOMNodeInserted', erect, false);
				document.body.addEventListener('DOMNodeRemoved', destroy, false);
			}
		},

		destruct: function (obj) {
			//Instance can either be a DOM element or a Rome Component instance
			obj = getInstance(obj);

			// All components can provide a destructor, which is modeled after C++/C# `~ComponentName`
			each(obj._rome.mixins, function (mixin) {
				var destructorName = '~' + mixin._rome.name;
				obj[destructorName] && obj[destructorName]();
			});
		},

		construct: function (obj) {
			//Instance can either be a DOM element or a Rome Component instance
			obj = getInstance(obj);

			// Executes each mixin's constructor function, if one exists, which is based on the mixin's name
			eachReverse(obj._rome.mixins, function (mixin) {
				var constructorName = mixin._rome.name;
				obj[constructorName] && obj[constructorName]();
			});
		}
	};

	// The foundation for all components provided by Rome.
	// Allows users to provide a new foundation for functionality they want baked in.
	Rome.Foundation = (function () {
		var destroy = function (state) {
			state = state || {};
			var root = this.root;

			// All child components should be cleaned up along with the parent 
			eachReverse($('[data-rome]', root).concat(root), strats.destruct);

			// If a domObserver picked up the removal there is no need to remove the node again
			!state.domObserved && root.parentNode.removeChild(root);
		};
		
		function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = destroy;
		};

		Foundation._rome = { name: 'Foundation' };

		return Foundation;
	})();

	// Before you can erect a component you must plan for it.
	// `baseComponent` is what Rome will be creating instances of via `[data-rome]`.
	// The `mixins` is an array of all the functionality you want in a component.
	// `name` is what you want your component known as. 
	// This must be provided if `baseComponent._rome.name` is not set.
	// Unforuntately, minification might mangle the function name, so we had to resort to being explicit
	Rome.plan = function (baseComponent, mixins, name) {
		// An anonymous function to merge all mixins into, so that the baseComponent 
		// can be the last mixin merged into the base
		var base = function () { };

		// We store the component name as a static to always make it easily accessible
		baseComponent._rome || (baseComponent._rome = { name: name });

		mixins = (mixins || []).concat(strats.autoMixins);

		// We always add Rome.Foundation for common functionality in components
		// and let the baseComponent reign supreme
		mixins.unshift(baseComponent, Rome.Foundation);

		eachReverse(mixins, function (mixin) {
			mixin = typeof mixin != 'string' ? mixin : reg.findComponent(mixin);

			strats.mixin(base, mixin);
		});

		reg.addComponent(base, baseComponent, mixins);

		// If Rome has already been built we want to instantly erect the newly planned component
		//@TODO: Determine whether this is even needed with MutationObservers
		//wasRomeBuilt && erectInstances($('[data-rome="' + baseComponent.name + '"]'));
	};

	function erectInstances(components) {
		eachReverse(components, Rome.erect);
	}

	var wasRomeBuilt = false;
	// After you're done planning all your components or simply want to start erecting your components.
	Rome.build = function () {
		// Rome can only be built once, so bail if it is accidentally called again
		if (wasRomeBuilt) return;

		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		//Configurable selector would be useful + configurable data attributes
		erectInstances($('[data-rome]'));

		strats.domObserver();
		wasRomeBuilt = true;
	};

	//Should this even be publicly exposed?
	Rome.erect = function (root) {
		if (root._rome) return;

		var romeComponentName = root.getAttribute('data-rome'),
			storedComponent = reg.findComponent(romeComponentName);

		if (!storedComponent.cachedComponent) {
			function Component(root) {
				this.root = root;
				// We support jQuery-like libraries to allow for "advanced" manipulation of the dom
				jQueryCompat && (this.$root = jQueryCompat(root));

				strats.construct(this);
			}

			// Finally adds in everything from the base component's `prototype` before creating a new component instance
			Component.prototype = storedComponent.base.prototype;
			// Makes looking up a component's mixins extremely easy
			Component.prototype._rome = { mixins: storedComponent.mixins };
			// Cache this Rome.Component, so that creating numerous instances doesn't require recreating the function
			storedComponent.cachedComponent = Component;
		}

		//Need mixin initialization strategy?
		reg.addInstance(root, romeComponentName, new storedComponent.cachedComponent(root));
	};

	//@TODO: Global PubSub?
	Rome.Empire;
	//@TODO: Routing?
	Rome.Roads;
	//@TODO: Binding? Use Event Delegation? Copy Derby?
	Rome.Allegiance

	//@TODO support AMD/Common
	this.Rome = Rome;
})();