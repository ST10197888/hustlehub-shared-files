let users = []
let nextId = 1

function findByEmail(email){
    return users.find(user => user.email === email)
}

function addUser(user){
    const newUser = { id: nextId, ...user }
    nextId += 1
    users.push(newUser)
    return newUser
}

module.exports = { findByEmail, addUser }