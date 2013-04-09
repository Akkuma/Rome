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
		findComponent: function (name) {
			return this.componentsLookup[name];
		},
		addComponent: function (base, component, mixins) {
			var name = Rome.getFnName(component);
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
		domObserver: function () {
			var MutationObserver = self.MutationObserver || self.WebKitMutationObserver;
			var observer = new MutationObserver(function(mutations) {
				for (var i = mutations.length; i >= 0; --i) {
					var mutation = mutations[i],
						addedNodes = mutation.addedNodes,
						removedNodes = mutation.removedNodes;
					
					for (var added = addedNodes.length; i >= 0; --i) {
						var addedNode = addedNodes[added],
							romeComponentName = addedNode.getAttribute('data-rome');

						romeComponentName && Rome.erect(addedNode, romeComponentName);
					}

					//@TODO determine if removedNodes mutation is even needed
					/*
					for (var removed = removedNodes.length; i >= 0; --i) { 
						var removedNode = removedNodes[added];

						removedNode._rome && removedNode._rome.component.destroy()
					}
					*/
				}
			  }); 
 
 			observer.observe(document.body, { subtree: true, childList: true });
		}
	};

	// The foundation for all components provided by Rome.
	// Allows users to provide a new foundation for functionality they want baked in.
	Rome.Foundation = (function () {
		var destroy = function (isParentCleanup) {			
			// We don't want a recursive find, so skip finding sub-components if parent initiated cleanup
			isParentCleanup || this.$root.find('[data-rome]').each(function () { this.root._rome.component.destroy(true); });
			this.$root.remove();
		};

		return function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = destroy;
		};
	})();

    Rome.getFnName = function (fn) {
        return fn.name || (fn.name = fn.toString().match(/^function\s*([^\s(]+)/)[1]);
    };

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
		mixins.push(Rome.Foundation);
		mixins.push(baseComponent);

		for	(var i = 0, len = mixins.length; i < len; i++) {
			var mixin = mixins[i];

			if (typeof mixin == 'string') {
				mixin = reg.findComponent(mixin);
			}

			Rome.Strategies.mixin(base, mixin);
		}

		reg.addComponent(base, baseComponent, mixins);

		// If Rome has already been built we want to instantly erect the newly planned component
		//@TODO: Determine whether this is even needed with MutationObservers
		//wasRomeBuilt && erectInstances($('[data-rome="' + Rome.getFnName(baseComponent) + '"]'));
	};

	function erectInstances($components) {
		for (var i = 0, len = $components.length; i < len; i++) {
			Rome.erect($components[i]);
		}
	}

	var wasRomeBuilt = false;
	// After you're done planning all your components or simply want to start erecting your components.
	Rome.build = function () {
		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		//Configurable selector would be useful + configurable data attributes
		erectInstances($('[data-rome]'));

		Rome.Strategies.domObserver();
		//wasRomeBuilt = true;
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
				var mixins = storedComponent.mixins;
				for (var i = 0, len = mixins.length; i < len; i++) {
					var mixinName = Rome.getFnName(mixins[i]);
					this[mixinName] && this[mixinName]();
				};
			}
			
			// Finally adds in everything from the base component's `prototype` before creating a new component instance
			Component.prototype = storedComponent.base.prototype;
			// Cache this Rome.Component, so that creating numerous instances doesn't require recreating the function
			storedComponent.cachedComponent = Component;
		}

        // Prevent double-initialization of this element.
        root.removeAttribute('data-rome');
        
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