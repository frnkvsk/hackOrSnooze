
const $submitForm = $("#submit-form");
const $author = $("#author");
const $title = $("#title");
const $url = $("#url");
const $filteredArticles = $("#filtered-articles");
const $favoriteStories = $("#favorited-articles");
const $ownStories = $("#my-articles");

const $loginForm = $("#login-form");
const $createAccountForm = $("#create-account-form");
const $allStoriesList = $("#all-articles-list");

const $navAll = $("#nav-all");
const $navLogin = $("#nav-login");
const $navLogOut = $("#nav-logout");

const $navWelcome = $("#nav-welcome");
const $navControl = $("#nav-control");

const $navCtrlSubmit = $("#nav-control-submit");
const $navCtrlFavorites = $("#nav-control-favorites");
const $navCtrlMyStories = $("#nav-control-myStories");

// global storyList variable
let storyList = null;

// global currentUser variable
let currentUser = null;

/**
 * navAll Event listener
 */
$navAll.on("click", async function(e) {
  if (currentUser) {
    await generateStories("far fa-star stars");
  }
  toggleDisplay("all");
});

/**
 * Event listener for logging in.
 *  If successfully we will setup the user instance
 */
$loginForm.on("submit", async function(evt) {
  evt.preventDefault(); // no page-refresh on submit

  // grab the username and password
  const username = $("#login-username").val();
  const password = $("#login-password").val();

  // call the login static method to build a user instance
  let userInstance;
  
  userInstance = await User.login(username, password);
  // set the global user to the user instance
  currentUser = userInstance;
  syncCurrentUserToLocalStorage();
  loginAndSubmitForm();
  if (currentUser) {
    showNavForLoggedInUser();
    await generateStories("far fa-star stars");
    showUserProfileInfo();
  }
  
});

/**
 * Event listener for logging out
 */
$navLogOut.on("click", function() {
  // empty out local storage
  localStorage.clear();
  // refresh the page, clearing memory
  location.reload();
});

/**
 * Event listener for signing up.
 *  If successfully we will setup a new user instance
 */
$createAccountForm.on("submit", async function(evt) {
  evt.preventDefault(); // no page refresh

  // grab the required fields
  let name = $("#create-account-name").val();
  let username = $("#create-account-username").val();
  let password = $("#create-account-password").val();

  // call the create method, which calls the API and then builds a new user instance
  const newUser = await User.create(username, password, name);

  // if newUser if undefined there was an error signing in so don't login user
  if(newUser != undefined) {
    currentUser = newUser;
    syncCurrentUserToLocalStorage();
    loginAndSubmitForm();
    showUserProfileInfo();
  }    
});


/**
 * Event listener for Clicking Login
 */
$navLogin.on("click", function() {
  // Show the Login and Create Account Forms
  $loginForm.slideToggle();
  $createAccountForm.slideToggle();
  $allStoriesList.toggle();
});

/**
 * Event listener for submitting new story
 */
$navCtrlSubmit.on("click", function() {
  toggleDisplay("submit");
});

/**
 * Event listener for submitting a new story to API
 */
$submitForm.on("click", function(e) {
  e.preventDefault();
  if($(e.target).is(":button")) {
    const author = $author.val();
    const title = $title.val();
    const url = $url.val();
    const token = localStorage.getItem("token");
    const story = {author, title, url};
    submitStoryHandler(token, story);
  }
});

/**
 * Event listener for showing user favorites
 */
$navCtrlFavorites.on("click", function() {
  reloadFavorites();
  // toggle visible elements
  toggleDisplay("favorites");
});

/**
 * Event listener for showing user stories
 */
$navCtrlMyStories.on("click", function() {
  // empty myArticles OL list
  $ownStories.empty();
  // loop through all stories and generate HTML for each
  for(let story of currentUser.ownStories) {
    const result = generateStoryHTML(story, "fa-trash-alt fas trash-myown");
    $ownStories.append(result);
  }
  toggleDisplay();
});

/**
 * Event listener for star or trash can icon click events 
 */
$(".articles-container").on("click", async e => {
  const storyId = $(e.target).parent().attr("id");
  if($allStoriesList.is(":visible")) {
    // all stories visible
    if($(e.target).hasClass("fas")) {
      $(e.target).addClass("far");
      $(e.target).removeClass("fas");
      removeFavoriteClickHandler(storyId);    
      toggleDisplay("all");    
    } else {
      $(e.target).addClass("fas");
      $(e.target).removeClass("far");
      addFavoriteClickHandler(storyId);
      toggleDisplay("all");
    }
  } else if($ownStories.is(":visible") && $(e.target).hasClass("trash-myown")) {
    // own stories visible
    await removeOwnStoryClickHandler(storyId);
    // reload own stories minus story we removed
    reloadOwn();
  } else if ($(e.target).hasClass("trash-myfav")) {
    // favorite stories visible
    await removeFavoriteClickHandler(storyId);
    // reload favorites list minus story we removed
    reloadFavorites();      
  }
  
})

/**
 * addFavoriteClickHandler: helper function to handle star icon click events
 * adds a favorite to the user's account on the API and updates local storage
 * @param { story id provided by API } storyId 
 */
async function addFavoriteClickHandler(storyId) {
  const res = await User.addFavoriteStory(currentUser.loginToken, currentUser.username, storyId);
  if(res.status == 200) {
    for(let e of storyList.stories) {
      if(e.storyId == storyId) {
        currentUser.favorites.push(e)
      }        
    }
  }
}

/**
 * removeFavoriteClickHandler: helper function to handle trash can icon events
 * removes a user favorite from user favorite list
 * @param { story id provided by API } storyId 
 */
async function removeFavoriteClickHandler(storyId) {
  const res = await User.removeFavoriteStory(currentUser.loginToken, currentUser.username, storyId);
  if(res.status == 200) {
    currentUser.favorites = currentUser.favorites.filter(e => e.storyId != storyId);
  } 
}

/**
 * removeOwnStoryClickHandler: helper function to handle trash can icon events
 * removes a users own story from the API
 * @param { story id provided by API } story_Id 
 */
async function removeOwnStoryClickHandler(story_Id) {
  const token = currentUser.loginToken;
  const res = await User.removeOwnStory(token, story_Id);
  if(res.status == 200) {
    let temp = currentUser.ownStories.slice();
    currentUser.ownStories = [];
    for(let story of temp) {
      let {storyId} = story;
      if(storyId != story_Id) {
        currentUser.ownStories.push(story);
      }
    }
  }
}

/**
 * submitStoryHandler: helper function for submit button listener
 * tries to upload a new story to the API
 * if successful updates the local storage to reflect the new user story and
 * updates the display to show the new user story
 * @param { user login token provided by the API } token 
 * @param { Story object that contains information about the story } story 
 */
async function submitStoryHandler(token, story) {
  const res = await StoryList.addStory(token, story);
  if(res.status == 201) {
    $submitForm.hide();
    generateStories("far fa-star stars");
    story["storyId"] = res.data.story.storyId;
    currentUser.ownStories.push(story);
    localStorage.setItem("ownStories", currentUser.ownStories);
  }
}

/**
 * On page load, checks local storage to see if the user is already logged in.
 * Renders page information accordingly.
 */
async function checkIfLoggedIn() {
  // let's see if we're logged in
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  // if there is a token in localStorage, call User.getLoggedInUser
  //  to get an instance of User with the right details
  //  this is designed to run once, on page load
  currentUser = await User.getLoggedInUser(token, username);

  if (currentUser) {
    showNavForLoggedInUser();
    await generateStories("far fa-star stars");
    showUserProfileInfo();
  }
}

/**
 * showUserProfileInfo: shows user profile info
 */
const showUserProfileInfo = () => {
    $("#profile-name").text(`Name: ${currentUser.name}`);
    $("#profile-username").text(`Username: ${currentUser.username}`);
    let dateCreated = currentUser.createdAt;
    $("#profile-account-date").text(`Account Created: 
          ${dateCreated.slice(0,dateCreated.indexOf("T"))}`);
}
/**
 * reloadFavorites: reloads Favorites after deleting a favorite
 */
const reloadFavorites = () => {
  // empty out that part of the page
  $favoriteStories.empty();
  if(currentUser.favorites.length) {
    // loop through all of our stories and generate HTML for them
    for (let story of currentUser.favorites) {      
      const result = generateStoryHTML(story, "fa-trash-alt fas trash-myfav");
      $favoriteStories.append(result);
    }
  }  
}

/**
 * reloadOwn: reloads the Own Stories page after deleting a story
 */
const reloadOwn = () => {
  // empty $ownStories UL
  $ownStories.empty();
  // loop through all of our stories and generate HTML for them
  for (let story of currentUser.ownStories) {  
    const result = generateStoryHTML(story, "fa-trash-alt fas trash-myown");
    $ownStories.append(result);
  }
}

/**
 * A rendering function to run to reset the forms and hide the login info
 */
function loginAndSubmitForm() {
  // hide the forms for logging in and signing up
  $loginForm.hide();
  $createAccountForm.hide();

  // reset those forms
  $loginForm.trigger("reset");
  $createAccountForm.trigger("reset");

  // show the stories
  $allStoriesList.show();

  // update the navigation bar
  showNavForLoggedInUser();
}

/**
 * A rendering function to call the StoryList.getStories static method,
 *  which will generate a storyListInstance. Then render it.
 */
async function generateStories(iconClass) {
  // get an instance of StoryList
  const storyListInstance = await StoryList.getStories();
  // update our global variable
  storyList = storyListInstance;
  // empty out that part of the page
  $allStoriesList.empty();
  let favArray = currentUser.favorites.map(e => e.storyId);
  // loop through all of our stories and generate HTML for them
  for (let story of storyList.stories) {
    let result;
    if(favArray.includes(story.storyId)) {
      result = generateStoryHTML(story, "fas fa-star stars");
    } else {
      result = generateStoryHTML(story, iconClass);
    }
    
    $allStoriesList.append(result);
  }
  $allStoriesList.show();
}

/**
 * A function to render HTML for an individual Story instance
 */
function generateStoryHTML(story, iconClass) {
  let hostName = getHostName(story.url);

  // render story markup
  const storyMarkup = $(`
    <li id="${story.storyId}">      
    <i class="${iconClass}"></i>
      <a class="article-link" href="${story.url}" target="a_blank">
        <strong>${story.title}</strong>
      </a>
      <small class="article-author">by ${story.author}</small>
      <small class="article-hostname ${hostName}">(${hostName})</small>
      <small class="article-username">posted by ${story.username}</small>
    </li>
  `);

  return storyMarkup;
}

/**
 * toggleDisplay: displays hidden elements 
 * @param {element to display} newDisp 
 */
const toggleDisplay = (newDisp) => {
  hideElements();
  if(newDisp == "all") {
    $allStoriesList.show();
  } else if(newDisp == "submit") {
    $submitForm.show();      
  } else if(newDisp == "favorites") {
    $favoriteStories.show();      
  } else {
    $ownStories.show();
  }
}

/**
 * hide all elements on document
 */
function hideElements() {
  const elementsArr = [
    $submitForm,
    $allStoriesList,
    $filteredArticles,
    $ownStories,
    $loginForm,
    $createAccountForm,
    $favoriteStories
  ];
  elementsArr.forEach($elem => $elem.hide());
}

/**
 * showNavForLoggedInUser: changes the navigation bar to the functionality 
 * for a logged in user
 */
function showNavForLoggedInUser() {
  $navLogin.hide();
  $navLogOut.show();
  $navWelcome.text(currentUser.username);
  $navWelcome.show();
  $navControl.show();
}

/**
 * simple function to pull the hostname from a URL
 */
function getHostName(url) {
  let hostName;
  if (url.indexOf("://") > -1) {
    hostName = url.split("/")[2];
  } else {
    hostName = url.split("/")[0];
  }
  if (hostName.slice(0, 4) === "www.") {
    hostName = hostName.slice(4);
  }
  return hostName;
}

/**
 * Store user information to localstorage
 */
function syncCurrentUserToLocalStorage() {
  if (currentUser) {
    localStorage.setItem("token", currentUser.loginToken);
    localStorage.setItem("username", currentUser.username);
    localStorage.setItem("favorites", currentUser.favorites);
    localStorage.setItem("ownStories", currentUser.ownStories);
  }
}
/**
 * checkIfLoggedIn: checks if user is currently logged in and shows user info
 */
checkIfLoggedIn();