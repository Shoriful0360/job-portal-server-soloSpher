const express = require('express')
const cors = require('cors')
const jwt=require('jsonwebtoken')
const cookiParser=require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()


const corsOptions={
  origin:['http://localhost:5173','http://localhost:5174'],
 credentials:true,
 optionalSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(cookiParser())

// verify token
const tokenVerify=(req,res,next)=>{
  // step:1 get token from cookie
  const token=req.cookie?.token
  if(!token){
    return res.status(401).send({message:'Unauthorized access'})
  }

  // step 2: if got token then verify token ,parameter(token,secret key,give callback function(err,decoded))
  jwt.verify(token,process.env.SECRET_KEY,(err,decoded)=>{
// if will be error 
if(err){
  res.status(403).send({message:'Unauthorized access'})
}
// if will not err then catch req and give a name send decoded(onek data thake)
req.user=decoded
next()
  })


}



// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@main.yolij.mongodb.net/?retryWrites=true&w=majority&appName=Main`
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.onkli.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`




// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    // Send a ping to confirm a successful connection

    // token create
    app.post('/jwt',async(req,res)=>{
 const email=req.body;
      const token=jwt.sign(email,process.env.SECRET_KEY,{expiresIn:'1d'})
      console.log(token)
      res
      .cookie('token',token,{

        httpOnly:true,
        secure:process.env.NODE_ENV==='production',
        sameSite:process.env.NODE_ENV==='production'?'none':'strict'
      })
      .send({success:true})
    })


    // token remove when user logout
    app.get('/logout',async(req,res)=>{
      res
      .clearCookie('token',{
        
        maxAge:0,
        // or
        //   httpOnly:true,
        secure:process.env.NODE_ENV==='production',
        sameSite:process.env.NODE_ENV==='production'?'none':'strict'
      })
      .send({success:true})
    })


    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )

// job related api
const jobCollection=client.db('job-portal-soloSphere').collection('job')
const bidsCollection=client.db('job-portal-soloSphere').collection('bids')

// step:1  
app.post('/jobs',async(req,res)=>{
  const data=req.body;
  const result=await jobCollection.insertOne(data);
  res.send(result)
})

// step:2 get all data from server site
app.get('/jobs',async(req,res)=>{

const filter=req.query.filter;
const search=req.query.search;
const sort=req.query.sort;

let query={}
// filter data
if(filter){
  query={category: filter}
}
// data by search
if(search){
  query={job_title:{
    $regex:search,$options:'i'
  }}
}
 let options={}
// sort data 
if(sort){
  options={sort:{deadLine:sort==='asc'?1 :-1}}
}
  const result=await jobCollection.find(query,options).toArray()
  res.send(result)
})

// get data by email from database
app.get('/jobs/:email',async(req,res)=>{
  const email=req.params.email;
  
  const query={"buyer.email": email}
  const result=await jobCollection.find(query).toArray();
  res.send(result)
})

// get data by id from database
app.get('/jobs/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)}
  const result=await jobCollection.findOne(query)
  res.send(result)
})


app.get('/job/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)}
  const result=await jobCollection.findOne(query)
  res.send(result)
})

// delete data by id server and client site
app.delete('/job/:id',async(req,res)=>{
  const id=req.params.id;
  const query={_id: new ObjectId(id)}
  const result=await jobCollection.deleteOne(query)
  res.send(result)
})

// update data
app.put('/update/:id',async(req,res)=>{
 const id=req.params.id;
 const query={_id: new ObjectId(id)}
 const jobData=req.body;

const options={upsert:true}
const update={
  $set: jobData
}
const result=await jobCollection.updateOne(query,update,options)
res.send(result)
})


// bids realated api
// save to server site bids request
app.post('/bids',async(req,res)=>{
  const bidsData=req.body;

  // if a user bids same jobportal then exist user
   const filter={email:bidsData.email, job_id:bidsData.job_id}

   const alreadyExist=await bidsCollection.findOne(filter)
   if(alreadyExist){
    return res.status(403).send('Not Permition')
   }
   console.log('already',alreadyExist)
  //  save data in bids collection
  const result=await bidsCollection.insertOne(bidsData);

  const query={_id: new ObjectId(bidsData.job_id)}
const updateDoc={
  $inc:{totalBids:1}
}
  const updateBidsCount=await jobCollection.updateOne(query,updateDoc)

  res.send(result)
})

// get all bids collection by specific user
app.get('/bids/:email',tokenVerify,async(req,res)=>{
  const decodedEmail=req.user?.email
  const email=req.params.email;
  if(decodedEmail !==email){
    return   res.status(403).send({message:'Unauthorized access'})
  }
  const isBuyer=req.query.buyer;
  let query={}
 if(isBuyer){
  query.buyer_email=email
 }
 else{
    query.email=email
 }
  const result=await bidsCollection.find(query).toArray();
  res.send(result)
})

// update bids status
app.patch('/bids-status-update/:id',async(req,res)=>{
  const id=req.params.id;
  const status=req.body;
  const query={_id: new ObjectId(id)}
  const updateStatus={
    $set:status
  }

  const result=await bidsCollection.updateOne(query,updateStatus)
  res.send(result)
})

  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
