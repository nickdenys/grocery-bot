'use strict'

const express = require('express')
const sqlite = require('sqlite3').verbose()
let db = new sqlite.Database('./data/database.sqlite')
const Promise = require('bluebird')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')

const app = express()
const port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

//*********************************************
// Database
//*********************************************

function fetchList() {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      db.all("SELECT * FROM Groceries", function(err, rows) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'groceries': rows
          }
          resolve(responseObj)
        }
      })
    })
    db.close()
  })
}

function addToList(text) {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("INSERT INTO Groceries (name) VALUES (?)")
      stmt.run(text, function(err) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'item': this
          }
          resolve(responseObj)
        }
      })
      stmt.finalize()
    })
    db.close()
  })
}

function deleteFromList(id) {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("DELETE FROM Groceries WHERE id=(?)")
      stmt.run(id, function(err) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'item': this
          }
          resolve(responseObj)
        }
      })
      stmt.finalize()
    })
    db.close()
  })
}

function updateItem(id, val) {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("UPDATE Groceries SET name = (?) WHERE id = (?)")
      stmt.run(val, id, function(err) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'item': this
          }
          resolve(responseObj)
        }
      })
      stmt.finalize()
    })
    db.close()
  })
}

function clearList() {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("DROP TABLE IF EXISTS Groceries")
      stmt.run(function(err) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'response': this
          }
          resolve(responseObj)
        }
      })
      stmt.finalize()
    })
    db.close()
  })
}

function createList() {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("CREATE TABLE `Groceries` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE, `name` TEXT );")
      stmt.run(function(err) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'response': this
          }
          resolve(responseObj)
        }
      })
      stmt.finalize()
    })
    db.close()
  })
}

//*********************************************
// Commands
//*********************************************

slapp.command('/grocery', 'help', (msg) => {
  var HELP_TEXT = `
  I will respond to the following messages:
  \`help\` - to see this message.
  \`list\` - to see all items on the grocery list.
  \`add [item]\` - to add an item to the list.
  \`edit [id] new [item]\` - to edit an item on the list.
  \`remove [id]\` - to remove an item from the list.
  \`clear\` - to remove all items from the list and start from scratch.
  `
  msg.say(HELP_TEXT)
})

slapp.command('/grocery', 'list', (msg) => {
  try {
    let groceries = null
    let groceries_text = ``

    fetchList()
      .then((response) => {
        if(response.error) {
          console.log(response.error)
          msg.respond("Something went wrong. We can't seem to find your list :anguished:")
        } else {
          groceries = response.groceries
          for(var i=0; i<groceries.length; i++) {
            console.log(groceries[i])
            if(i==0) {
              groceries_text = `:memo: *Here's the grocery list:*`
            }
            groceries_text += `
*#` + groceries[i].id + `* - ` + groceries[i].name
          }
          msg.respond(groceries_text)
        }
      })
  } catch (err) {
    msg.respond("Something went wrong. We can't seem to find your list :anguished:")
    next(err)
  }
})

slapp.command('/grocery', 'add (.*)', (msg, text, item) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    try {
      addToList(item)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Something went wrong. We couldn't add that to the list :scream:")
          } else {
            console.log(response.item)
            msg.respond(":heavy_check_mark: Alright! We've added it to the list.")
          }
        })
    } catch (err) {
      msg.respond("Something went wrong. We couldn't add that to the list :sweat:")
      next(err)
    }
  }
})

slapp.command('/grocery', 'remove (.*)', (msg, text, id) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    try {
      deleteFromList(id)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Something went wrong. We couldn't remove that item from the list :triumph:")
          } else {
            console.log(response.item)
            msg.respond(":x: Done! We've removed it from the list.")
          }
        })
    } catch (err) {
      msg.respond("Something went wrong. We couldn't remove that item from the list :triumph:")
    }
  }
})

slapp.command('/grocery', 'edit (.*)', (msg, text, details) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    // Extract ID and the new text
    let vars = details.split("new")
    for (var i=0;i<vars.length; i++) {
      vars[i] = vars[i].trim()
    }
    let id = vars[0]
    let newText = vars[1]

    try {
      updateItem(id, newText)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Something went wrong. We couldn't edit that item :triumph:")
          } else {
            console.log(response.item)
            msg.respond(":floppy_disk: Saved! The item has been edited.")
          }
        })
    } catch (err) {
      msg.respond("Something went wrong. We couldn't edit that item :triumph:")
    }
  }
})

slapp.command('/grocery', 'clear', (msg, text) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    try {
      clearList()
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Something went wrong. We couldn't clear the grocery list :triumph:")
          } else {
            console.log(response)
            createList()
              .then((response) => {
                if(response.error) {
                  console.log(response.error)
                  msg.respond("Something went wrong. We couldn't create a new grocery list :triumph:")
                } else {
                  msg.respond(":zap: Clear! Everything has been removed from the list.")
                }
              })
          }
        })
    } catch (err) {
      msg.respond("Something went wrong. We couldn't clear the grocery list :triumph:")
    }
  }
})

//*********************************************
// Example functions
//*********************************************

// var HELP_TEXT = `
// I will respond to the following messages:
// \`help\` - to see this message.
// \`hi\` - to demonstrate a conversation that tracks state.
// \`thanks\` - to demonstrate a simple response.
// \`<type-any-other-text>\` - to demonstrate a random emoticon response, some of the time :wink:.
// \`attachment\` - to see a Slack attachment message.
// `
//
// // response to the user typing "help"
// slapp.message('help', ['mention', 'direct_message'], (msg) => {
//   msg.say(HELP_TEXT)
// })
//
// // "Conversation" flow that tracks state - kicks off when user says hi, hello or hey
// slapp
//   .message('^(hi|hello|hey)$', ['direct_mention', 'direct_message'], (msg, text) => {
//     msg
//       .say(`${text}, how are you?`)
//       // sends next event from user to this route, passing along state
//       .route('how-are-you', { greeting: text })
//   })
//   .route('how-are-you', (msg, state) => {
//     var text = (msg.body.event && msg.body.event.text) || ''
//
//     // user may not have typed text as their next action, ask again and re-route
//     if (!text) {
//       return msg
//         .say("Whoops, I'm still waiting to hear how you're doing.")
//         .say('How are you?')
//         .route('how-are-you', state)
//     }
//
//     // add their response to state
//     state.status = text
//
//     msg
//       .say(`Ok then. What's your favorite color?`)
//       .route('color', state)
//   })
//   .route('color', (msg, state) => {
//     var text = (msg.body.event && msg.body.event.text) || ''
//
//     // user may not have typed text as their next action, ask again and re-route
//     if (!text) {
//       return msg
//         .say("I'm eagerly awaiting to hear your favorite color.")
//         .route('color', state)
//     }
//
//     // add their response to state
//     state.color = text
//
//     msg
//       .say('Thanks for sharing.')
//       .say(`Here's what you've told me so far: \`\`\`${JSON.stringify(state)}\`\`\``)
//     // At this point, since we don't route anywhere, the "conversation" is over
//   })
//
// // Can use a regex as well
// slapp.message(/^(thanks|thank you)/i, ['mention', 'direct_message'], (msg) => {
//   // You can provide a list of responses, and a random one will be chosen
//   // You can also include slack emoji in your responses
//   msg.say([
//     "You're welcome :smile:",
//     'You bet',
//     ':+1: Of course',
//     'Anytime :sun_with_face: :full_moon_with_face:'
//   ])
// })
//
// // demonstrate returning an attachment...
// slapp.message('attachment', ['mention', 'direct_message'], (msg) => {
//   msg.say({
//     text: 'Check out this amazing attachment! :confetti_ball: ',
//     attachments: [{
//       text: 'Slapp is a robust open source library that sits on top of the Slack APIs',
//       title: 'Slapp Library - Open Source',
//       image_url: 'https://storage.googleapis.com/beepboophq/_assets/bot-1.22f6fb.png',
//       title_link: 'https://beepboophq.com/',
//       color: '#7CD197'
//     }]
//   })
// })
//
// // Catch-all for any other responses not handled above
// slapp.message('.*', ['direct_mention', 'direct_message'], (msg) => {
//   // respond only 40% of the time
//   if (Math.random() < 0.4) {
//     msg.say([':wave:', ':pray:', ':raised_hands:'])
//   }
// })

//*********************************************
// Server
//*********************************************

// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})
