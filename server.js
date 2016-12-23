const express = require('express')
const sqlite = require('sqlite3').verbose()
let db = new sqlite.Database('./data/database.sqlite')
const Promise = require('bluebird')
const Slapp = require('slapp')
const ConvoStore = require('slapp-convo-beepboop')
const Context = require('slapp-context-beepboop')

const app = express()
const port = process.env.PORT || 3000

let slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

let _items = null
updateLocalList()



//*********************************************
// Database
//*********************************************

function updateLocalList() {
  fetchList()
    .then((response) => {
      if(!response.error) {
        _items = response.items
      }
    })
}

function fetchList() {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      db.all("SELECT * FROM Items", function(err, rows) {
        if (err) {
          console.log(err)
          let responseObj = {
            'error': err
          }
          reject(responseObj)
        } else {
          let responseObj = {
            'items': rows
          }
          resolve(responseObj)
        }
      })
    })
    db.close()
  })
}

function addToList(text, user) {
  return new Promise((resolve, reject) => {
    db = new sqlite.Database('./data/database.sqlite')
    db.serialize(() => {
      let stmt = db.prepare("INSERT INTO Items (name,user) VALUES (?,?)")
      stmt.run([text, user], function(err) {
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
          updateLocalList()
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
      let stmt = db.prepare("DELETE FROM Items WHERE id=(?)")
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
          updateLocalList()
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
      let stmt = db.prepare("UPDATE Items SET name = (?) WHERE id = (?)")
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
          updateLocalList()
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
      let stmt = db.prepare("DROP TABLE IF EXISTS Items")
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
          _items = null
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
      let stmt = db.prepare("CREATE TABLE `Items` ( `id` INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE, `name` TEXT, `user` TEXT );")
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
          _items = null
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

slapp.command('/lunch', 'help', (msg) => {
  var HELP_TEXT = `
  I will respond to the following messages:
  \`help\` - to see this message.
  \`list\` - to see all items on the lunch list.
  \`add [item]\` - to add an item to the list.
  \`edit [id] [new text]\` - to edit an item on the list.
  \`remove [id]\` - to remove an item from the list.
  \`clear\` - to remove all items from the list and start from scratch.
  `
  msg.say(HELP_TEXT)
})

slapp.command('/lunch', 'list', (msg) => {
  try {
    let items = null
    let items_text = ``

    fetchList()
      .then((response) => {
        if(response.error) {
          console.log(response.error)
          msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
        } else {
          items = response.items
          if(items.length == 0) {
            msg.respond("The list is empty! Fill it up by typing `/lunch add [item]`")
          }
          for(var i=0; i<items.length; i++) {
            if(i==0) {
              items_text = `:point_down: *Here's the lunch list:*`
            }
            items_text += `
:white_circle: *` + items[i].id + `* - @` + items[i].user + ` - ` + items[i].name
          }
          msg.say(items_text)
        }
      })
  } catch (err) {
    msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
    next(err)
  }
})

slapp.command('/lunch', 'add (.*)', (msg, text, item) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    try {
      let user = msg.body.user_name
      addToList(item, user)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Beep boop. Something went wrong :face_with_head_bandage: :computer: :fire:")
          } else {
            msg.respond(`:heavy_check_mark: Alright! I've added "${item}" to the list.`)
          }
        })
    } catch (err) {
      msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
      next(err)
    }
  }
})

slapp.command('/lunch', 'remove (.*)', (msg, text, id) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    let currentItem = null
    let toBeRemovedItem = null
    for(let i=0; i<_items.length; i++) {
      currentItem = _items[i]
      if(currentItem.id == id) {
        toBeRemovedItem = currentItem.name
      }
    }
    msg.respond({
      text: '',
      attachments: [
        {
          text: `Are you sure? This will remove "${toBeRemovedItem}" from the list.`,
          color: "#FF0000",
          fallback: 'Delete or Cancel?',
          callback_id: 'delete_item_callback',
          actions: [
            { name: 'answer', text: 'Delete', type: 'button', value: id, style:'danger' },
            { name: 'answer', text: 'Cancel',  type: 'button',  value: 'cancel' }
          ]
        }]
      })
  }
})

slapp.command('/lunch', 'edit (.*)', (msg, text, details) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    // Extract ID and the new text
    let vars = details.split(/\s(.+)/)
    let id = vars[0]
    let newText = vars[1]

    try {
      updateItem(id, newText)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
          } else {
            msg.respond(":floppy_disk: Changes have been saved!")
          }
        })
    } catch (err) {
      msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
    }
  }
})

slapp.command('/lunch', 'clear', (msg, text) => {
  if (!text) {
    msg.respond("Whoops. Try again.")
  } else {
    msg.respond({
      text: '',
      attachments: [
        {
          text: 'Are you sure? This will delete all items on your list.',
          color: "#FF0000",
          fallback: 'Delete or Cancel?',
          callback_id: 'clear_list_callback',
          actions: [
            { name: 'answer', text: 'Delete', type: 'button', value: 'delete', style:'danger' },
            { name: 'answer', text: 'Cancel',  type: 'button',  value: 'cancel' }
          ]
        }]
      })
  }
})

//*********************************************
// Actions
//*********************************************

slapp.action('delete_item_callback', 'answer', (msg, value) => {
  if (value != 'cancel') {
    try {
      deleteFromList(value)
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
          } else {
            msg.respond(":x: Done! I've removed it from the list.")
          }
        })
    } catch (err) {
      msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
    }
  } else {
    msg.respond('Okay, I won\'t delete that. Relax! :relaxed:')
  }
})

slapp.action('clear_list_callback', 'answer', (msg, value) => {
  if (value == 'delete') {
    try {
      clearList()
        .then((response) => {
          if(response.error) {
            console.log(response.error)
            msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
          } else {
            createList()
              .then((response) => {
                if(response.error) {
                  console.log(response.error)
                  msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
                } else {
                  msg.respond(`:zap: Zap! @${msg.body.user.name} cleared the list.`)
                }
              })
          }
        })
    } catch (err) {
      msg.respond("Bzzz... Something went wrong :face_with_head_bandage: :computer: :fire:")
    }
  } else {
    msg.respond('Okay, I won\'t clear the list. I promise. :relieved:')
  }
})

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
