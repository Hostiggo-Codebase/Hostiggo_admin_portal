// MainScreen.java
package com.chick;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Screen;
import com.badlogic.gdx.audio.Sound;
import com.badlogic.gdx.graphics.GL20;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.scenes.scene2d.Stage;
import com.badlogic.gdx.scenes.scene2d.ui.ImageButton;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.viewport.FitViewport;
import com.badlogic.gdx.scenes.scene2d.InputEvent;
import com.badlogic.gdx.scenes.scene2d.utils.ClickListener;
import com.badlogic.gdx.scenes.scene2d.ui.Image;

import com.badlogic.gdx.utils.viewport.Viewport;

public class Tutorial2 implements Screen {
    private Stage stage;
    private chick game;
    private Viewport viewport;

    private Texture blur;
    private Texture back;


    private Image blur_i;
    private Image back_i;

    private Sound clickSound;
    private Sound hoverSound;


    public Tutorial2 (chick game) {
        this.game = game;
        viewport = new FitViewport(Gdx.graphics.getWidth(), Gdx.graphics.getHeight());
        stage = new Stage(viewport);

        clickSound = Gdx.audio.newSound(Gdx.files.internal("click.mp3"));
        hoverSound = Gdx.audio.newSound(Gdx.files.internal("hover.mp3"));



        blur = new Texture(Gdx.files.internal("tut1/3.png"));

        back = new Texture(Gdx.files.internal("tut1/2.png"));

        ImageButton back_button = new ImageButton(new TextureRegionDrawable(back));


        back_button.setPosition(470, -80);
        back_button.setSize(130, 240);


        blur_i = new Image(blur);
        blur_i.setSize(stage.getWidth(), stage.getHeight());
        blur_i.setPosition(0,0);
        stage.addActor(blur_i);

        // Create non-clickable CHICK image

        back_button.addListener(new ClickListener() {
            @Override
            public void clicked(InputEvent event, float x, float y) {
                clickSound.play();
                game.setScreen(new Tutorial3(game));  // Pass the next screen
            }
        });


        stage.addActor(back_button);

        Gdx.input.setInputProcessor(stage);
    }


    @Override
    public void show() { }
    @Override
    public void render(float delta) {
        // Clear the screen with a background color
        Gdx.gl.glClearColor(0, 0, 0, 0); // White background
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);

        // Update and draw the stage
        stage.act(delta);
        stage.draw();
    }

    @Override
    public void resize(int width, int height) {
        viewport.update(width, height, true);
    }


    @Override
    public void pause() { }

    @Override
    public void resume() { }

    @Override
    public void hide() { }

    @Override
    public void dispose() {
        stage.dispose();
        blur.dispose();
        back.dispose();
        clickSound.dispose();
        hoverSound.dispose();
    }
}
