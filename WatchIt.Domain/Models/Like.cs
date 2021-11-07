namespace WatchIt.Data.Models;

public class Like
{
    public int Id { get; set; }
    public Movie Movie { get; set; }
    public ApplicationUser User { get; set; }
}
