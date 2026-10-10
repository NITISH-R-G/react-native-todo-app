#!/bin/bash
# Lists the test user's tasks as the server stores them (password is the local test value).
EMAIL=$(cat "$TEMP/e2e_email.txt")
TOKEN=$(curl -s -X POST localhost:4000/auth/login -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"Passw0rdOK1\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
curl -s "localhost:4000/tasks${1:-}" -H "Authorization: Bearer $TOKEN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=JSON.parse(s).tasks;console.log('count',t.length);t.forEach(x=>console.log(JSON.stringify({title:x.title,priority:x.priority,tags:x.tags,completed:x.completed,deadline:x.deadline})))})"
