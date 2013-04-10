// Rome 0.2.0
// ==========
// "Opinions are good, only when I agree with them." This is Rome's entire philosophy to development.

// If you want to actually work on Rome here are some things you should keep in mind.

// - If it could be done differently it should be exposed to others
// - Rome should make as few assumptions as possible, but still build a good OOBE
// - Smaller, sleeker code is better, but don't completely sacrifice performance
// - Functional programming is highly approved, but keep the previous point in mind
// - Rome should have no dependencies, if possible, unless the library is small enough one could embed or it is so popular it is a "standard"

(function () {
	function nope(){}
	
	function Rome() {}

	//Potential for supporting multiple registries within Rome?
	function Registry() {
		this.componentsLookup = {};
		/*
		this.components = [];
		this.instances = {};
		*/
	}

	// Should be a reference to the window object for now
	var self = this;
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

	//@TODO add setter to manipulate $ if set later defineProperty
	var $ = Rome.$ = self.jQuery || self.Zepto || self.$;

	// Strategies are a minimal abstraction/transformation layer
	// that will allow users to replace the OOBE of Rome.
	Rome.Strategies = {
		mixin: function (obj, mixin) {
			mixin(obj);
		},

		// Handles all DOM changes as to automatically wire-up and destroy components
		domObserver: function () {
			function addComponent(node) {
				node = node.target || node;
				var romeComponentName = node.getAttribute('data-rome');
				romeComponentName && Rome.erect(node, romeComponentName);
			}

			function removeComponent(node) {
				node = node.target || node;
				node._rome && node._rome.component.destroy()
			}

			var MutationObserver = self.MutationObserver || self.WebKitMutationObserver;
			if (MutationObserver) {
				var observer = new MutationObserver(function(mutations) {
					mutations.forEach(function (mutation) {
						mutation.addedNodes.forEach(addComponent);
						mutation.removedNodes.forEach(removeComponent);
					});
				 }); 
	 
				observer.observe(document.body, { subtree: true, childList: true });
			}
			else {
				document.body.addEventListener('DOMNodeInserted', addComponent, false);
				document.body.addEventListener('DOMNodeRemoved', removeComponent, false);
			}
		}
	};

	// The foundation for all components provided by Rome.
	// Allows users to provide a new foundation for functionality they want baked in.
	Rome.Foundation = (function () {
		var destroy = function (isParentCleanup) {			
			// We don't want a recursive find, so skip finding sub-components if parent initiated cleanup
			isParentCleanup || this.$root.find('[data-rome]').each(function () { this.root._rome.component.destroy(true); });
			this.$root.remove();

			// All components can provide a destructor, which is modeled after C++ `~ComponentName`
			for (var i = 0, len = this._rome.mixins.length; i < len; i++) {
				var mixinName = this._rome.mixins[i]._rome.name;
				this['~' + mixinName] && this['~' + mixinName]();
			}
		};

		return function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = destroy;
		};
	})();

	var fnNameRegEx = new RegExp(/function\s+([^\s\(]+)/);
	// We normalize the mixin name, so that in the future we don't have to call a getMixinName repeatedly
	function setMixinName(mixin) {
		if (mixin._rome) return;

		var name = mixin.name;

		// Support IE through manually setting the toString or we'll parse it out
		// RegEx chosen based on this test http://jsperf.com/get-a-function-s-name
		if (!name) {
			var toString = mixin.toString();
			name = toString.indexOf('(') != -1 ? fnNameRegEx.exec(toString)[1] : toString;
		}

		mixin._rome = { name: name };
	}

	// Before you can erect a component you must plan for it.
	// The `mixins` is an array of all the functionality you want in a component.
	// The first mixin is treated as the `baseComponent`
	Rome.plan = function (baseComponent, mixins) {
		// An anonymous function to merge all mixins into, so that the baseComponent 
		// can be the last mixin merged into the base
		var base = function () {};

		mixins = mixins || [];

		// We always add Rome.Foundation for common functionality in components
		// and let the baseComponent reign supreme
		mixins.unshift(baseComponent, Rome.Foundation);

		for	(var i = mixins.length - 1; i >= 0; --i) {
			var mixin = mixins[i];
				mixin = typeof mixin != 'string' ? mixin : reg.findComponent(mixin);

			setMixinName(mixin);
			Rome.Strategies.mixin(base, mixin);
		}

		reg.addComponent(base, baseComponent, mixins);

		// If Rome has already been built we want to instantly erect the newly planned component
		//@TODO: Determine whether this is even needed with MutationObservers
		//wasRomeBuilt && erectInstances($('[data-rome="' + baseComponent.name + '"]'));
	};

	function erectInstances($components) {
		for (var i = 0, len = $components.length; i < len; i++) {
			Rome.erect($components[i]);
		}
	}

	var wasRomeBuilt = false;
	// After you're done planning all your components or simply want to start erecting your components.
	Rome.build = function () {
		// Rome can only be built once, so bail if it is accidentally called again
		if (wasRomeBuilt) return;

		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		//Configurable selector would be useful + configurable data attributes
		erectInstances($('[data-rome]'));

		Rome.Strategies.domObserver();
		wasRomeBuilt = true;
	};

	//Should this even be publicly exposed?
	Rome.erect = function (root, romeComponentName) {
		romeComponentName = romeComponentName || root.getAttribute('data-rome');
		var storedComponent = reg.findComponent(romeComponentName);

		if (!storedComponent.cachedComponent) {
			function Component(root) {
				this.root = root;
				this.$root = $(root);
			
				// Executes each mixin's constructor function, if one exists, which is based on the mixin's name
				for (var i = this._rome.mixins.length - 1; i >= 0; --i) {
					var mixinName = this._rome.mixins[i]._rome.name;
					this[mixinName] && this[mixinName]();
				};
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

	//@TODO support AMD/Common
	this.Rome = Rome;
})();