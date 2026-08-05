package com.faltu;

import com.badlogic.gdx.physics.box2d.Body;
import com.badlogic.gdx.physics.box2d.Contact;
import com.badlogic.gdx.physics.box2d.ContactImpulse;
import com.badlogic.gdx.physics.box2d.ContactListener;
import com.badlogic.gdx.physics.box2d.Manifold;

public class MyContactListener implements ContactListener {

    @Override
    public void beginContact(Contact contact) {
        // Get the two bodies involved in the collision
        Body bodyA = contact.getFixtureA().getBody();
        Body bodyB = contact.getFixtureB().getBody();

        // You can use the userData or other properties to identify the objects
        String objectA = (String) bodyA.getUserData();
        String objectB = (String) bodyB.getUserData();

        // Now you can add your if-else condition to check which objects are colliding
        if (objectA.equals("Player") && objectB.equals("Enemy")) {
            // Code when Player collides with Enemy
            System.out.println("Player and Enemy are touching!");
            // Implement your logic here
        } else if (objectA.equals("Player") && objectB.equals("Obstacle")) {
            // Code when Player collides with Obstacle
            System.out.println("Player and Obstacle are touching!");
            // Implement your logic here
        } else if (objectA.equals("Enemy") && objectB.equals("Obstacle")) {
            // Code when Enemy collides with Obstacle
            System.out.println("Enemy and Obstacle are touching!");
            // Implement your logic here
        } else {
            // Code for other collisions
            System.out.println("Some other objects are touching.");
            // Implement your logic here
        }
    }

    @Override
    public void endContact(Contact contact) {
        // Code for when the objects stop touching (if needed)
    }

    @Override
    public void preSolve(Contact contact, Manifold oldManifold) {
        // Code before the collision happens (optional)
    }

    @Override
    public void postSolve(Contact contact, ContactImpulse impulse) {
        // Code after the collision happens (optional)
    }
}

