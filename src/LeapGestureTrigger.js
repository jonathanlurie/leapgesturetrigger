/*
* Author    Jonathan Lurie - http://me.jonahanlurie.fr
* License   MIT
* Link      https://github.com/jonathanlurie/leapgesturetrigger
* Lab       MCIN - http://mcin.ca/ - Montreal Neurological Institute
*/


import * as LeapObject from 'leapjs'
const Leap = LeapObject.default;

/*
What is a rule?
A rule is an object that is of a specific form. In the following example,
'handGesture' is a rule.
First, it's a array. If of size 1: this is a single hand gesture.
If of size 2: both hand gesture.
 
 
 
var handGesture = [
  // hand #1 ---------------------------

  // list of tests:
  [

    // test #1 of hand #1
    {
      // the method name exists in the class LeapGestureTrigger
      method: "allFingerSpread",
      
      // the validator takes in argument the returned values of "allFingerSpread".
      // Each validator must return a boolean. Here, it is a simple relay
      validator: function( b ){
        return b;
      },
      args: [] // optional, it he method needs argument, they must be here as an array
    },

    // test #2 of hand #1
    {
      // the method name exists in the class LeapGestureTrigger
      method: "handVelocity",
      
      // the validator takes in argument the returned values of "handVelocity".
      // Each validator must return a boolean. Here, we consider the velocity
      // along x-axis and return if it's above a threshold
      validator: function( v ){
        return v[0] > 10;
      }

  ],

  // hand #2 ------------------------------
  // optional.
  [ ... ]
]
 
When a rule's callback is called, the array of hands is given in argument.
If the rule involves both hands, they will always be ordered [left, right]
 
*/



class LeapGestureTrigger {
  
  /**
  * [STATIC]
  * Finger gesture code when the index finger is extended
  * @return {Number} the code
  */
  static get F_POINT(){
    return 2;
  }
  
  /**
  * [STATIC]
  * Finger gesture code when index finger and the thumb are extended
  * @return {Number} the code
  */
  static get F_POINT_AND_THUMB(){
    return 3;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when index finger and middel are extended
  * @return {Number} the code
  */
  static get F_PEACE(){
    return 6;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when index finger, middle and thumb are extended
  * @return {Number} the code
  */
  static get F_THREE(){
    return 7;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when the palm is closed (no finger extended)
  * @return {Number} the code
  */
  static get F_FIST(){
    return 0;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when all finder are extended (not necessary spread)
  * @return {Number} the code
  */
  static get F_OPEN_PALM(){
    return 31;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when the thumb is extended
  * @return {Number} the code
  */
  static get F_THUMB_UP(){
    return 1;
  }
  
  
  /**
  * [STATIC]
  * Finger gesture code when the pinky is extended
  * @return {Number} the code
  */
  static get F_PINKY_UP(){
    return 16;
  }
  
  
  constructor( ) {
    this._controller = null;
    this._currentFrame = null;
    this._nbHands = 0;
    
    // list of gesture name based on their code
    this._fingerGesture = {
      point          : LeapGestureTrigger.F_POINT,      // index finger extended
      pointAndThumb  : LeapGestureTrigger.F_POINT_AND_THUMB,  // index finger and thumb extended
      peace          : LeapGestureTrigger.F_PEACE,      // index finger and middle finger extended
      three          : LeapGestureTrigger.F_THREE,      // thum, index and middle finger extended
      fist           : LeapGestureTrigger.F_FIST,       // no finger extended, close fist
      openPalm       : LeapGestureTrigger.F_OPEN_PALM,  // all finger extended
      thumbUp        : LeapGestureTrigger.F_THUMB_UP,   // only thumb extended
      pinkyUp        : LeapGestureTrigger.F_PINKY_UP,   // only the pinky is extended (not sure this one is practical)
    }
    
    // rule are combinations of gestures + callback
    this._ruleSets = [];
    
    this._events = {
      nothing: null,
      everyFrame: null
    };
  }


  /**
  * Add a rule and associate a callback. See the header of this file to know what is a rule.
  * @param {Object} rule - the rule (see format on the header of this file)
  * @param {Function} callback - to call when the rule is detected
  * @param {Function} callbackNo - to call when this rule was not detected (can be null)
  * @param {Object} options -
  *   - "name": String - a name for this rule
  *   - "blocking": Boolean - if true, won't try the next rules if this one applies. Default: true
  *   - "ambidextrousMono": for single-hand gesture only: can be performed by one
  *                         or the other even though both are showing. Default: true
  */
  addRule( rule, callback, callbackNo, options = {} ){
    if( typeof callback !== "function" ){
      console.warn("The rule callback must be a function");
      return;
    }
    
    if(  callbackNo && typeof callbackNo !== "function" ){
      console.warn("The callback for not trigering the rule must be a function when not null.");
      return;
    }
    
    if( !this._validateRule(rule) ){
      console.warn("The rule is not valid");
      return;
    }
      
    
    this._ruleSets.push({
      rule              : rule,
      callback          : callback,
      callbackNo        : callbackNo,
      name              : options.name || "rule #" + this._ruleSets.length,
      blocking          : "blocking" in options ? options.blocking : true,
      ambidextrousMono  : "ambidextrousMono" in options ? options.ambidextrousMono : true,
    })
  }
  
  
  
  /**
  * [PRIVATE]
  * Feed it a rule and it will tell if the format is valid
  * @param {Object} rule - the rule
  * @return {Boolean} true id the rule is valid
  */
  _validateRule( rule ){
    // cannot be null
    if( !rule )
      return false;
    
    // must be an array  
    if( !Array.isArray( rule ) )
      return false;
      
    // must have at leat one hand rule
    if( !rule.length )
      return false;
      
    
    // for each hand rule (max 2)
    for(var h=0; h<rule.length; h++){
      var handRule = rule[h]
      
      // a rule of a hand cannot be null
      if( !handRule )
        return false;
      
      // must be an array  
      if( !Array.isArray( handRule ) )
        return false;
        
      // must have at leat one test
      if( !handRule.length )
        return false;
      
      for(var t=0; t<handRule.length; t++){
        var test = handRule[t];
        
        // each test must have a 'method' attribute
        if( !("method" in test) )
          return false;
        
        // the method must belong to _this_
        if( !(test.method in this) )
          return false;
          
        // a test must have a "validator" attribute
        if( !("validator" in test) )
          return false;
          
        // the validator attribute must be a function
        if( typeof test.validator !== "function" )
          return false;
          
        // extra arguments, if preset, must be an array
        if( "args" in test && !Array.isArray( test.args ))
          return false;
          
      }
    }
    
    return true;
  }
  
  
  _runRuleSets(){
    var atLeastOneRuleApplied = false;
    
    for(var i=0; i<this._ruleSets.length; i++){
      var ruleSet = this._ruleSets[i];
      var rule = ruleSet.rule;
      var callback = ruleSet.callback;
      var callbackNo = ruleSet.callbackNo;
      var name = ruleSet.name;
      var blocking = ruleSet.blocking;
      var ambidextrousMono = ruleSet.ambidextrousMono;
      
      var applies = this._runRule( rule, ambidextrousMono );
      atLeastOneRuleApplied |= applies;
      
      if( applies ){
        if( this._currentFrame.hands.length == 1 ){
          callback( this._currentFrame.hands )
        }else{
          var leftHand = null;
          var rightHand = null;
          
          if( this._currentFrame.hands[0].type === "left" ){
            leftHand = this._currentFrame.hands[0];
            rightHand = this._currentFrame.hands[1];
          }else{
            leftHand = this._currentFrame.hands[1];
            rightHand = this._currentFrame.hands[0];
          }
          
          callback( [leftHand, rightHand] );
        }
        
        
        // if this rule is blocking, we dont run the other ones
        if(blocking){
          break;
        }
      }else if( callbackNo ){
        callbackNo();
      }
    }
    
    // not a single rule was applied, we call the "nothing" event
    if( !atLeastOneRuleApplied && this._events.nothing ){
      this._events.nothing();
    }
  }
  
  
  /**
  * Run a single rule and tells if it applies or not.
  * @param {Object} rule - the rule to test
  * @return {Boolean} true if the rule applies, false if not
  */
  _runRule( rule, ambidextrousMono ){
    var hands = this._currentFrame.hands;
    
    // 1 - check if the Leap sees the proper amount of hand required by this rule
    if(rule.length > this._nbHands )
      return false;

    // the rule requires 2 hands
    if( rule.length == 2 ){
      var appliesHand1 = this._runHalfRule( rule[0], hands[0] );
      var appliesHand2 = this._runHalfRule( rule[1], hands[1] );
      return (appliesHand1 && appliesHand2);
    }
    // the rule requires only one hand
    else{
      // we first test on the hand[0]
      var appliesHand1 = this._runHalfRule( rule[0], hands[0] );
      var appliesHand2 = false;
      
      // if the rule is ambidextrous and 2 hands are visible on the Leap
      // we run the single-hand rule on the second hand
      if( ambidextrousMono && this._nbHands == 2){
        appliesHand2 = this._runHalfRule( rule[0], hands[1] );
      }
      
      return (appliesHand1 || appliesHand2);
    }
    
    return false;
  }
  
  
  /**
  * [PRIVATE]
  * runs a half-rule on a given hand. A half-rule is a single element of a rule (that is an array of size max 2).
  * In other words, a rule can be composed of 2 half-rule if it applied to 2 hands.
  * Some rules apply only to a single hand, implicitely they are already half-rules encapsulated in an array
  */
  _runHalfRule( halfRule, hand ){
    
    // running each test of the half rule
    for(var i=0; i<halfRule.length; i++){
      var test = halfRule[i];
      var args = test.args || [];
      var methodReturned = this[ test.method ]( hand, ...args );
      var validatorReturned = test.validator( methodReturned );
      
      if( !validatorReturned )
        return false;
    }
    
    return true;
  }
  
  
  start(){
    this._controller = Leap.loop( this._loop.bind( this ) );
  }
  
  
  
  _loop( frame ){
    this._currentFrame = frame;
    
    this._nbHands = 0;
    
    if( this._events.everyFrame ){
      this._events.everyFrame();
    }
    
    // the frame must be valid
    if( !frame.valid )
      return;

    this._nbHands = this.numberOfHands();
    
    if( !this._nbHands ){
      if( this._events.nothing ){
        this._events.nothing();
      }
      return;
    }
    
    this._runRuleSets();
    
  }
  

  /**
  * Get the distance between the tips of two given fingers
  */
  _getfingertipDistance( finger1, finger2){
    if( !finger1.valid || !finger2.valid )
      return -1;
      
    var manhattanDistance = [
      finger1.tipPosition[0] - finger2.tipPosition[0],
      finger1.tipPosition[1] - finger2.tipPosition[1],
      finger1.tipPosition[2] - finger2.tipPosition[2],
    ]
    
    return Math.sqrt(
      manhattanDistance[0]*manhattanDistance[0] +
      manhattanDistance[1]*manhattanDistance[1] +
      manhattanDistance[2]*manhattanDistance[2]
    );
  }
  
  
  numberOfHands(){
    var hands = this._currentFrame.hands;
    var numberOfHands = 0;
    
    // ONE hand
    if( hands.length == 1){
      if( hands[0].valid){
        numberOfHands = 1;
      }
      
    }
    // possibly TWO hands
    else if( hands.length == 2 ){
      if( hands[0].valid && hands[1].valid ){
          numberOfHands = 2;
      }else if( hands[0].valid && !hands[1].valid ){
          numberOfHands = 1;
      }else if ( !hands[0].valid && hands[1].valid ) {
          numberOfHands = 1;
      }
    }
    
    return numberOfHands;
  }
  
  
  /**
    * Get if all the finger of a given hand are valid
    * @param {Hand} hand - a Leapjs Hand instance
    * @return {Boolean} true if all fingers of this hand are valid
    */
    allFingersValid( hand ){
      return ( 
        hand.indexFinger.valid && 
        hand.middleFinger.valid && 
        hand.ringFinger.valid && 
        hand.pinky.valid &&
        hand.thumb.valid
      )
    }
    
    

    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the point gesture
    */
    point( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.point );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the pointAndThumb gesture
    */
    pointAndThumb( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.pointAndThumb );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the peace gesture
    */
    peace( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.peace );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the three gesture
    */
    three( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.three );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the fist gesture
    */
    fist( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.fist );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the openPalm gesture
    */
    openPalm( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.openPalm );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the thumbUp gesture
    */
    thumbUp( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.thumbUp );
    }
    
    
    /**
    * Finger interaction.
    * @param {Hand} hand - Leap hand object
    * @return {Boolean} true if the given hand performs the pinkyUp gesture
    */
    pinkyUp( hand ){
      var fingerCode = this.fingerExtendedCode( hand );
      return ( fingerCode == this._fingerGesture.pinkyUp );
    }
    
    
    /**
    * Spread fingers is diferent than extended fingers. Spread mean extended + do not
    * touch each other, are distant.
    * return true if the fingers are spread, false if not
    * @param {Finger} f1 - a finger
    * @param {Finger} f2 - another finger
    * @param {Number} distanceMm - threshold distance in mm, default 30
    * @return {}
    */
    twoFingersSpread( f1, f2, distanceMm = 30 ){
      // Since the pinky is significantly shorter, the tip distance to the ring finger
      // is larger, say by 5mm
      var threshold = f1.type == 4 || f2.type == 4 ? distanceMm + 5 : distanceMm;
      // same idea for the thumb
      threshold = f1.type == 0 || f2.type == 0 ? distanceMm * 2.5 : distanceMm;
      return ( this._getfingertipDistance( f1, f2 ) > threshold );
    }
    
    
    /**
    * Return true if the hand is spread
    */
    allFingerSpread( hand ){
      return (
        this.twoFingersSpread( hand.fingers[0], hand.fingers[1] ) &&
        this.twoFingersSpread( hand.fingers[1], hand.fingers[2] ) &&
        this.twoFingersSpread( hand.fingers[2], hand.fingers[3] ) &&
        this.twoFingersSpread( hand.fingers[3], hand.fingers[4] )
      )
    }
    
    
    /**
    * return true if the given finger is extended
    */
    fingerExtended( f ){
      return f.extended;
    }
    
    
    /**
    * Get the number of hands visible
    */
    numberOfHands( ){
      return this._currentFrame.hands.length;
    }
    
    
    /**
    * Get a distance vector from n frames ago to the current one.
    * In case of doubt, maybe just use handVelocity() (which is built-in)
    */
    handTranslationDelta( hand, frameDelta = 1 ){
      return hand.translation( this._controller.frame(frameDelta) );
    }
    
    
    /**
    * The velocity of the palm in mm/s
    * @param {Hand} hand - a Leapjs Hand instance
    * @return {Array} of velocity along axis [x, y, z]
    */
    palmVelocity( hand ){
      return hand.palmVelocity;
    }
    
    
    /**
    * Yaw angle in rad
    */
    handYaw( hand ){
      return hand.yaw();
    }
    
    
    /**
    * Pitch angle in rad
    */
    handPitch( hand ){
      return hand.pitch();
    }
    
    
    /**
    * Roll angle in rad
    */
    handRoll( hand ){
      return hand.roll();
    }
    
    
    /**
    * Get the rotation angle of the given hand, from some fram ago (default: 1 frame ago)
    * @param {Hand} hand - instance of Leapjs Hand
    * @param {Number} frameDelta - since how many frames ago do we want this angle
    * @return {Number} the angle in rad
    */
    handRotationAngle( hand, frameDelta = 1 ){
      return hand.rotationAngle( this._controller.frame(frameDelta) )
    }
    
    
    /**
    * Get the rotation axis of the given hand, from some fram ago (default: 1 frame ago)
    * @param {Hand} hand - instance of Leapjs Hand
    * @param {Number} frameDelta - since how many frames ago do we want this rotation axis
    * @return {Array} the axis in 3D as [x, y, z]
    */
    handRotationAxis( hand, frameDelta = 1 ){
      return hand.rotationAxis( this._controller.frame(frameDelta) )
    }
    
    
    /**
    * Get the rotation matrix of the given hand, from some fram ago (default: 1 frame ago)
    * @param {Hand} hand - instance of Leapjs Hand
    * @param {Number} frameDelta - since how many frames ago do we want this rotation axis
    * @return {Array} the 3x3 matrix as a single dimensional array, row major.
    */
    handRotationMatrix( hand, frameDelta = 1 ){
      return hand.rotationMatrix( this._controller.frame(frameDelta) )
    }
    
    
    /**
    * for a given hand, get a code based on what fingers are extended.
    * Each extended finger add up to a code to create a unique checksum
    * - thumb + 1
    * - index + 2
    * - middle + 4
    * - ring + 8
    * - pinky + 16
    * @param {Hand} hand - a leap js hand object
    * @return {Number} the code
    */
    fingerExtendedCode( hand ){
      return 0b00000001 * hand.thumb.extended |
             0b00000010 * hand.indexFinger.extended |
             0b00000100 * hand.middleFinger.extended |
             0b00001000 * hand.ringFinger.extended |
             0b00010000 * hand.pinky.extended; 
    }
    
    
    /**
    * Same as fingerExtendedCode but works for 2 hands.
    * @param {Hand} hand1 - a leap js hand object
    * @param {Hand} hand2 - a leap js hand object
    * @return {Array} the code for both hands
    */
    fingerExtendedCode2hands( hand1, hand2 ){
      return [
        this.fingerExtendedCode( hand1 ),
        this.fingerExtendedCode( hand2 )
      ];
    }
    
    
    /**
    * Get the pinch strenght of the given hand.
    * @param {Hand} hand - the Leap hand object
    * @return {Number} strenght in [0, 1]
    */
    pinchStrength( hand ){
      return hand.pinchStrength;
    }
    
    
    /**
    * Get the pinch strenght of both hands
    * @param {Hand} hand - the Leap hand object
    * @return {Number} strenght in [0, 1]
    */
    pinchStrength2Hands( hand1, hand2 ){
      return [
        hand1.pinchStrength,
        hand2.pinchStrength,
      ]
    }
    
    
    /**
    * Get the grabstrenght of the given hand, in [0, 1]
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Number} the strength
    */
    grabStrengh( hand ){
      return hand.grabStrength;
    }
    
    
    /**
    * Silly function to get the hand object in a rule validator function
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Hand} the same Leapjs Hand instance
    */
    hand( hand ){
      return hand;
    }
    
    
    /**
    * Get the palm normal
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Array} normal vector as [x, y, z] 
    */
    palmNormal( hand ){
      return hand.palmNormal;
    }
    
    
    /**
    * Get the palm stabilized position
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Array} position vector as [x, y, z], each in mm from the leap origin 
    */
    palmPosition( hand ){
      return hand.stabilizedPalmPosition
    }
    
    
    /**
    * Get the average outer width of the hand (not including fingers or thumb) in millimeters
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Number} the width in mm 
    */
    palmWidth( hand ){
      return hand.palmWidth;
    }
    
    
    /**
    * Get center of the sphere that fits the hand curvature.
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Array} position vector as [x, y, z]
    */
    sphereCenter( hand ){
      return hand.sphereCenter
    }
    
    
    /**
    * Get the sphere radius of the sphere the fits the hand curvature
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Number} the radius in mm
    */
    sphereRadius( hand ){
      return hand.sphereRadius;
    }
    
    
    /**
    * Get the time this hand is visible
    * @param {Hand} hand - Leapjs Hand instance
    * @return {Number} time ins seconds
    */
    handTimeVisible( hand ){
      return hand.timeVisible
    }
    
    
    /**
    * Add a custom general event. General events are not associated to a specific gesture.
    * @param {String} eventName - name of the event
    * @param {Function} cb - callback function
    */
    on( eventName, cb ){
      if( eventName in this._events && typeof cb === "function" ){
        this._events[ eventName ] = cb;
      }
    }
    
    
} /* END of class LeapGestureTrigger */

export { LeapGestureTrigger };
